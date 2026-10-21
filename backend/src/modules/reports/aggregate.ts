import { prisma } from '../../config/database';
import { formatDay } from '../../lib/clock';

/** 링크 × 날짜 단위 집계 (봇 제외 수치 + 참고용 봇 수) */
export interface DailyRow {
  linkId: string;
  dayKey: Date;
  totalClicks: number;
  uniqueVisitors: number;
  mobileClicks: number;
  pcClicks: number;
  unknownClicks: number;
  botClicks: number;
  referers: Record<string, number>;
}

const emptyRow = (linkId: string, dayKey: Date): DailyRow => ({
  linkId, dayKey, totalClicks: 0, uniqueVisitors: 0, mobileClicks: 0, pcClicks: 0, unknownClicks: 0, botClicks: 0, referers: {},
});

const keyOf = (linkId: string, dayKey: Date) => `${linkId}|${formatDay(dayKey)}`;

interface RawFilter { linkIds?: string[]; fromDay?: Date; toDay?: Date; beforeDay?: Date }

function rawWhere(f: RawFilter) {
  return {
    ...(f.linkIds && { linkId: { in: f.linkIds } }),
    ...((f.fromDay || f.toDay || f.beforeDay) && {
      dayKey: { ...(f.fromDay && { gte: f.fromDay }), ...(f.toDay && { lte: f.toDay }), ...(f.beforeDay && { lt: f.beforeDay }) },
    }),
  };
}

/** 원본 클릭에서 일 집계를 계산한다 */
export async function aggregateRaw(filter: RawFilter): Promise<DailyRow[]> {
  const where = rawWhere(filter);
  const [counts, referers] = await Promise.all([
    prisma.clickEvent.groupBy({ by: ['linkId', 'dayKey', 'device', 'isBot', 'isUnique'], where, _count: { _all: true } }),
    prisma.clickEvent.groupBy({ by: ['linkId', 'dayKey', 'refererDomain'], where: { ...where, isBot: false }, _count: { _all: true } }),
  ]);
  const rows = new Map<string, DailyRow>();
  const get = (linkId: string, dayKey: Date) => {
    const k = keyOf(linkId, dayKey);
    let row = rows.get(k);
    if (!row) { row = emptyRow(linkId, dayKey); rows.set(k, row); }
    return row;
  };
  for (const c of counts) {
    const row = get(c.linkId, c.dayKey);
    const n = c._count._all;
    if (c.isBot) { row.botClicks += n; continue; }
    row.totalClicks += n;
    if (c.isUnique) row.uniqueVisitors += n;
    if (c.device === 'MOBILE') row.mobileClicks += n;
    else if (c.device === 'PC') row.pcClicks += n;
    else row.unknownClicks += n;
  }
  for (const r of referers) {
    const row = get(r.linkId, r.dayKey);
    const domain = r.refererDomain ?? '(direct)';
    row.referers[domain] = (row.referers[domain] ?? 0) + r._count._all;
  }
  return [...rows.values()];
}

/**
 * 기간 내 일 집계. 원본이 남아 있는 날은 원본으로 계산하고(가장 정확),
 * 원본이 삭제된 날은 click_daily를 쓴다.
 */
export async function loadDailyRows(linkIds: string[], fromDay: Date, toDay: Date): Promise<DailyRow[]> {
  if (linkIds.length === 0) return [];
  const [stored, raw] = await Promise.all([
    prisma.clickDaily.findMany({ where: { linkId: { in: linkIds }, dayKey: { gte: fromDay, lte: toDay } } }),
    aggregateRaw({ linkIds, fromDay, toDay }),
  ]);
  const merged = new Map<string, DailyRow>();
  for (const s of stored) {
    merged.set(keyOf(s.linkId, s.dayKey), {
      linkId: s.linkId, dayKey: s.dayKey, totalClicks: s.totalClicks, uniqueVisitors: s.uniqueVisitors,
      mobileClicks: s.mobileClicks, pcClicks: s.pcClicks, unknownClicks: s.unknownClicks, botClicks: s.botClicks,
      referers: (s.referers ?? {}) as Record<string, number>,
    });
  }
  for (const r of raw) merged.set(keyOf(r.linkId, r.dayKey), r);
  return [...merged.values()];
}

/** 오늘 이전의 원본을 click_daily로 롤업한다 (같은 날을 다시 계산해도 결과가 같다) */
export async function rollupBefore(today: Date): Promise<number> {
  const rows = await aggregateRaw({ beforeDay: today });
  for (const r of rows) {
    const data = {
      totalClicks: r.totalClicks, uniqueVisitors: r.uniqueVisitors, mobileClicks: r.mobileClicks,
      pcClicks: r.pcClicks, unknownClicks: r.unknownClicks, botClicks: r.botClicks, referers: r.referers,
    };
    await prisma.clickDaily.upsert({
      where: { linkId_dayKey: { linkId: r.linkId, dayKey: r.dayKey } },
      create: { linkId: r.linkId, dayKey: r.dayKey, ...data },
      update: data,
    });
  }
  return rows.length;
}
