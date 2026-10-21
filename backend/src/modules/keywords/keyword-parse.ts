import type { RawRelKeyword } from './keyword-tool';

export type CompLevel = 'low' | 'mid' | 'high' | 'unknown';

export interface Volume {
  /** 정확한 값을 알 수 없으면 null (예: "<10") */
  value: number | null;
  /** 10 미만 */
  low: boolean;
}

export interface ParsedKeyword {
  keyword: string;
  pc: Volume;
  mobile: Volume;
  /** 정렬·합계용 추정치. "<10"은 5로 본다 */
  estimatedTotal: number;
  compIdx: CompLevel;
}

const LOW_VOLUME_ESTIMATE = 5;

/** 검색량 파싱: 숫자, "1,234", "< 10"/"<10", 빈 값 모두 처리 */
export function parseVolume(raw: unknown): Volume {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? { value: Math.round(raw), low: raw < 10 } : { value: null, low: false };
  }
  if (typeof raw !== 'string') return { value: null, low: false };
  const s = raw.replace(/\s+/g, '');
  if (/^<\d+$/.test(s)) return { value: null, low: true };
  const digits = s.replace(/,/g, '');
  if (/^\d+(\.\d+)?$/.test(digits)) {
    const n = Math.round(Number(digits));
    return { value: n, low: n < 10 };
  }
  return { value: null, low: false };
}

/** 경쟁 정도: 명세는 low/mid/high, 실제 응답은 한글로 오는 경우가 있어 둘 다 받는다 */
export function parseCompIdx(raw: unknown): CompLevel {
  if (typeof raw !== 'string') return 'unknown';
  const s = raw.trim().toLowerCase();
  if (s === 'low' || s === '낮음') return 'low';
  if (s === 'mid' || s === 'middle' || s === 'medium' || s === '중간') return 'mid';
  if (s === 'high' || s === '높음') return 'high';
  return 'unknown';
}

function estimate(v: Volume): number {
  if (v.value !== null) return v.value;
  return v.low ? LOW_VOLUME_ESTIMATE : 0;
}

export function parseKeywordList(list: unknown): ParsedKeyword[] {
  if (!Array.isArray(list)) return [];
  const out: ParsedKeyword[] = [];
  const seen = new Set<string>();
  for (const item of list as RawRelKeyword[]) {
    if (!item || typeof item !== 'object') continue;
    const keyword = typeof item.relKeyword === 'string' ? item.relKeyword.trim() : '';
    if (!keyword || keyword.length > 100 || seen.has(keyword)) continue;
    seen.add(keyword);
    const pc = parseVolume(item.monthlyPcQcCnt);
    const mobile = parseVolume(item.monthlyMobileQcCnt);
    out.push({ keyword, pc, mobile, estimatedTotal: estimate(pc) + estimate(mobile), compIdx: parseCompIdx(item.compIdx) });
  }
  return out;
}

/** 힌트 정규화: 공백 제거(네이버는 힌트에 공백을 허용하지 않음), 쉼표 제거, 중복 제거, 최대 5개 */
export function normalizeHints(hints: string[]): string[] {
  const out: string[] = [];
  for (const h of hints) {
    const v = h.replace(/[\s,]+/g, '').slice(0, 50);
    if (v && !out.includes(v)) out.push(v);
    if (out.length === 5) break;
  }
  return out;
}

export function cacheKeyFor(hints: string[]): string {
  return [...hints].map(h => h.toLowerCase()).sort().join('|').slice(0, 300);
}
