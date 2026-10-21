import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { clock } from '../../lib/clock';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { getSetting } from '../settings/settings';
import { KeywordToolAdapter, KeywordToolRateLimitError } from './keyword-tool';
import { MockKeywordToolAdapter } from './mock.adapter';
import { NaverSearchAdAdapter } from './naver-searchad.adapter';
import { ParsedKeyword, cacheKeyFor, normalizeHints, parseKeywordList } from './keyword-parse';
import { RankedKeyword, rankKeywords } from './keyword-rank';

function createDefaultAdapter(): KeywordToolAdapter {
  return env.KEYWORD_TOOL_PROVIDER === 'naver'
    ? new NaverSearchAdAdapter(env.NAVER_SEARCHAD_API_KEY, env.NAVER_SEARCHAD_SECRET_KEY, env.NAVER_SEARCHAD_CUSTOMER_ID)
    : new MockKeywordToolAdapter();
}

let adapter: KeywordToolAdapter = createDefaultAdapter();

export function setKeywordToolAdapter(next: KeywordToolAdapter): void { adapter = next; }
export function getKeywordToolAdapter(): KeywordToolAdapter { return adapter; }

// 네이버 공지: 키워드 도구는 429 시 긴 대기, 연속 429면 최소 5분 전체 중단 → 프로세스 단위 직렬화 + 차단
const CIRCUIT_OPEN_MS = 5 * 60 * 1000;
let circuitOpenUntil = 0;
let queue: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export function resetKeywordToolState(): void {
  circuitOpenUntil = 0;
  queue = Promise.resolve();
}

export interface KeywordLookup {
  rows: ParsedKeyword[];
  source: string;
  cached: boolean;
  /** API 실패로 만료된 캐시를 대신 반환한 경우 */
  stale: boolean;
  fetchedAt: Date;
}

export async function lookupKeywords(rawHints: string[]): Promise<KeywordLookup> {
  const hints = normalizeHints(rawHints);
  if (hints.length === 0) throw new AppError('VALIDATION_ERROR', 400, '키워드를 하나 이상 입력하세요');
  const cacheKey = cacheKeyFor(hints);
  const now = clock.now();

  const cachedRow = await prisma.keywordCache.findUnique({ where: { cacheKey } });
  if (cachedRow && cachedRow.expiresAt > now) {
    return { rows: cachedRow.response as unknown as ParsedKeyword[], source: cachedRow.source, cached: true, stale: false, fetchedAt: cachedRow.fetchedAt };
  }

  const fallback = (reason: string): KeywordLookup => {
    if (cachedRow) {
      return { rows: cachedRow.response as unknown as ParsedKeyword[], source: cachedRow.source, cached: true, stale: true, fetchedAt: cachedRow.fetchedAt };
    }
    throw new AppError('KEYWORD_TOOL_UNAVAILABLE', 503, reason);
  };

  if (Date.now() < circuitOpenUntil) return fallback('키워드 조회가 잠시 제한됐습니다. 몇 분 후 다시 시도하세요');

  let rows: ParsedKeyword[];
  try {
    const raw = await serialized(() => adapter.fetchRelated(hints));
    rows = parseKeywordList(raw);
  } catch (err) {
    if (err instanceof KeywordToolRateLimitError) circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
    // 요청 헤더·키가 섞이지 않도록 오류 이름만 기록
    logger.warn('keyword tool request failed', { error: (err as Error).name, source: adapter.source });
    return fallback('키워드 조회에 실패했습니다. 잠시 후 다시 시도하세요');
  }

  const ttlDays = await getSetting('keyword.cacheTtlDays');
  const expiresAt = new Date(now.getTime() + ttlDays * 86400000);
  const data = { source: adapter.source, response: rows as unknown as Prisma.InputJsonValue, fetchedAt: now, expiresAt };
  await prisma.keywordCache.upsert({ where: { cacheKey }, create: { cacheKey, ...data }, update: data });
  return { rows, source: adapter.source, cached: false, stale: false, fetchedAt: now };
}

export interface RecommendInput {
  category: string;
  region: string;
  product?: string;
  extras?: string[];
}

export interface Recommendation extends Omit<KeywordLookup, 'rows'> {
  hints: string[];
  rows: RankedKeyword[];
  sortMode: string;
}

/** "지역+업종" 조합을 힌트에 넣고, 결과를 설정된 기준으로 정렬한다 */
export async function recommendKeywords(input: RecommendInput): Promise<Recommendation> {
  const region = input.region.trim();
  const category = input.category.trim();
  const product = input.product?.trim() ?? '';
  const regionTerms = region.split(/\s+/).filter(Boolean);
  const lastRegion = regionTerms[regionTerms.length - 1] ?? '';

  const hints = normalizeHints([
    lastRegion && category ? `${lastRegion}${category}` : '',
    lastRegion && product ? `${lastRegion}${product}` : '',
    category,
    product,
    ...(input.extras ?? []),
  ]);
  const lookup = await lookupKeywords(hints);
  const sort = await getSetting('keyword.sort');
  const rows = rankKeywords(lookup.rows, { regionTerms, categoryTerms: [category, product].filter(Boolean) }, sort).slice(0, 100);
  return { ...lookup, hints, rows, sortMode: sort.mode };
}
