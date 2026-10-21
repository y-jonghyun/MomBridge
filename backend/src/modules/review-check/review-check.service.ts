import { DisclosureCheck } from '@prisma/client';
import { prisma } from '../../config/database';
import { clock } from '../../lib/clock';
import { logger } from '../../utils/logger';
import { getSetting } from '../settings/settings';
import { NaverBlogPostRef } from './naver-blog-url';
import { FetchedPost, getPostFetcher, PostFetcher } from './post-fetcher';
import { analyzePost, DisclosurePosition, PostAnalysis } from './post-analyzer';

/** 수동 확인이 필요한 이유 (승인 차단) */
export type ManualReason = 'FETCH_FAILED' | 'POST_NOT_FOUND' | 'DISCLOSURE_NOT_FOUND' | 'DISCLOSURE_NOT_AT_TOP';
/** 참고용 경고 (승인 차단 안 함) */
export type CheckWarning = 'NO_TRACKING_LINK' | 'NO_MAIN_KEYWORD' | 'TOP_IMAGE_PRESENT';

export interface PostCheckResult {
  checkedAt: string;
  postUrl: string;
  httpStatus: number | null;
  postFound: boolean;
  hasTrackingLink: boolean | null;
  hasMainKeyword: boolean | null;
  disclosurePosition: DisclosurePosition | null;
  matchedPhrase: string | null;
  topImagePresent: boolean;
  manualReasons: ManualReason[];
  warnings: CheckWarning[];
}

export interface CheckOutcome { disclosureCheck: DisclosureCheck; result: PostCheckResult }

export interface CheckOptions {
  trackingCode: string | null;
  mainKeyword: string | null;
  disclosurePhrases: string[];
  topChars: number;
}

/** 조회 1회 + 분석. 저장하지 않으며, 진단 도구와 실제 제출 확인이 같은 로직을 쓴다 */
export async function runPostCheck(ref: NaverBlogPostRef, opts: CheckOptions, fetcher: PostFetcher = getPostFetcher()): Promise<
  CheckOutcome & { fetched: FetchedPost | null; fetchError: string | null; analysis: PostAnalysis | null }
> {
  const result: PostCheckResult = {
    checkedAt: clock.now().toISOString(),
    postUrl: ref.canonicalUrl,
    httpStatus: null,
    postFound: false,
    hasTrackingLink: null,
    hasMainKeyword: null,
    disclosurePosition: null,
    matchedPhrase: null,
    topImagePresent: false,
    manualReasons: [],
    warnings: [],
  };

  let fetched: FetchedPost;
  try {
    fetched = await fetcher.fetchPost(ref);
    result.httpStatus = fetched.status;
  } catch (err) {
    result.manualReasons.push('FETCH_FAILED');
    const e = err as Error;
    return { disclosureCheck: 'NEEDS_MANUAL_REVIEW', result, fetched: null, fetchError: `${e.name}: ${e.message}`, analysis: null };
  }

  const analysis = analyzePost(fetched.status === 200 ? fetched.html : '', opts);
  result.postFound = analysis.found;
  if (!analysis.found) {
    result.manualReasons.push(result.httpStatus === 200 ? 'POST_NOT_FOUND' : 'FETCH_FAILED');
    return { disclosureCheck: 'NEEDS_MANUAL_REVIEW', result, fetched, fetchError: null, analysis };
  }

  result.hasTrackingLink = opts.trackingCode ? analysis.hasTrackingLink : null;
  result.hasMainKeyword = analysis.hasMainKeyword;
  result.disclosurePosition = analysis.disclosurePosition;
  result.matchedPhrase = analysis.matchedPhrase;
  result.topImagePresent = analysis.topImagePresent;

  if (analysis.disclosurePosition === 'NONE') result.manualReasons.push('DISCLOSURE_NOT_FOUND');
  if (analysis.disclosurePosition === 'ELSEWHERE') result.manualReasons.push('DISCLOSURE_NOT_AT_TOP');
  if (opts.trackingCode && !analysis.hasTrackingLink) result.warnings.push('NO_TRACKING_LINK');
  if (analysis.hasMainKeyword === false) result.warnings.push('NO_MAIN_KEYWORD');
  if (analysis.topImagePresent && result.manualReasons.length) result.warnings.push('TOP_IMAGE_PRESENT');

  return {
    disclosureCheck: result.manualReasons.length ? 'NEEDS_MANUAL_REVIEW' : 'AUTO_PASSED',
    result, fetched, fetchError: null, analysis,
  };
}

/** 제출(재제출) 시 1회만 호출한다. 실패해도 예외를 던지지 않고 수동 확인으로 돌린다 */
export async function checkReviewPost(ref: NaverBlogPostRef, missionId: string, trackingCode: string | null): Promise<CheckOutcome> {
  const [mainKeyword, phrases, topChars] = await Promise.all([
    prisma.missionKeyword.findFirst({ where: { missionId, role: 'MAIN' }, select: { keyword: true } }),
    getSetting('submission.disclosurePhrases'),
    getSetting('submission.disclosureTopChars'),
  ]);
  const { disclosureCheck, result, fetchError } = await runPostCheck(ref, {
    trackingCode, mainKeyword: mainKeyword?.keyword ?? null, disclosurePhrases: phrases, topChars,
  });
  if (fetchError) logger.warn('review post fetch failed', { error: fetchError.split(':')[0] });
  return { disclosureCheck, result };
}

export const MANUAL_REASON_LABEL: Record<ManualReason, string> = {
  FETCH_FAILED: '게시글을 불러오지 못했습니다',
  POST_NOT_FOUND: '공개된 게시글을 찾지 못했습니다 (비공개·삭제 여부 확인)',
  DISCLOSURE_NOT_FOUND: '대가 표시 문구를 텍스트로 찾지 못했습니다 (이미지 표시 여부 확인)',
  DISCLOSURE_NOT_AT_TOP: '대가 표시 문구가 제목이나 첫 부분이 아닌 곳에 있습니다',
};
