import type { ParsedKeyword, CompLevel } from './keyword-parse';
import type { SettingValue } from '../settings/settings';

export type SortConfig = SettingValue<'keyword.sort'>;

export interface RankContext {
  /** 지역어 (예: 마포구, 망원동) */
  regionTerms: string[];
  /** 업종어 (예: 카페, 브런치) */
  categoryTerms: string[];
}

export interface RankedKeyword extends ParsedKeyword {
  score: number;
  isRegionCategory: boolean;
}

const COMPETITION_SCORE: Record<CompLevel, number> = { low: 1, mid: 0.5, high: 0, unknown: 0.3 };

/** 검색량이 [min, max] 구간 안이면 1, 밖이면 로그 거리만큼 감점 */
export function bandScore(volume: number, [min, max]: [number, number]): number {
  if (volume >= min && volume <= max) return 1;
  const v = Math.max(volume, 1);
  const distance = v < min ? Math.log10(min / v) : Math.log10(v / max);
  return Math.max(0, 1 - distance / 2);
}

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

export function regionCategoryScore(keyword: string, ctx: RankContext): { score: number; both: boolean } {
  const k = squash(keyword);
  const hasRegion = ctx.regionTerms.some(t => t && k.includes(squash(t)));
  const hasCategory = ctx.categoryTerms.some(t => t && k.includes(squash(t)));
  if (hasRegion && hasCategory) return { score: 1, both: true };
  return { score: hasRegion || hasCategory ? 0.5 : 0, both: false };
}

export function rankKeywords(rows: ParsedKeyword[], ctx: RankContext, sort: SortConfig): RankedKeyword[] {
  const { band, competition, regionCategory } = sort.weights;
  const ranked = rows.map(r => {
    const rc = regionCategoryScore(r.keyword, ctx);
    const score = band * bandScore(r.estimatedTotal, sort.volumeBand)
      + competition * COMPETITION_SCORE[r.compIdx]
      + regionCategory * rc.score;
    return { ...r, score: Math.round(score * 1000) / 1000, isRegionCategory: rc.both };
  });

  const byKeyword = (a: RankedKeyword, b: RankedKeyword) => a.keyword.localeCompare(b.keyword, 'ko');
  if (sort.mode === 'volume') {
    return ranked.sort((a, b) => b.estimatedTotal - a.estimatedTotal || byKeyword(a, b));
  }
  if (sort.mode === 'competition') {
    return ranked.sort((a, b) =>
      COMPETITION_SCORE[b.compIdx] - COMPETITION_SCORE[a.compIdx] || b.estimatedTotal - a.estimatedTotal || byKeyword(a, b));
  }
  return ranked.sort((a, b) => b.score - a.score || b.estimatedTotal - a.estimatedTotal || byKeyword(a, b));
}
