import { prisma } from '../../config/database';
import { addDays, clock, formatDay, kstDayKey } from '../../lib/clock';
import { getSetting } from '../settings/settings';
import { closeExpiredMissions } from '../missions/mission-lifecycle';
import { rollupBefore } from '../reports/aggregate';
import { deleteExpiredResetTokens } from '../auth/password-reset';

export interface DailyJobResult {
  today: string;
  cutoff: string;
  missionsToInProgress: string[];
  missionsClosed: string[];
  rolledUpRows: number;
  deletedClickEvents: number;
  deletedVisitorHashes: number;
  deletedKeywordCache: number;
  deletedShareLinks: number;
  deletedResetTokens: number;
}

/**
 * 일 배치 (여러 번 실행해도 결과가 같다).
 * 1) 어제까지의 원본을 일 집계로 롤업
 * 2) 보관 기간이 지난 원본 클릭·방문자 해시 삭제 — 해당 날짜가 롤업된 경우에만
 * 3) 오래된 키워드 캐시·만료된 공유 링크 정리
 * 4) 모집 마감일이 지난 '모집중' 미션의 상태 전환
 */
export async function runDailyJob(): Promise<DailyJobResult> {
  const today = kstDayKey(clock.now());
  const retentionDays = await getSetting('click.retentionDays');
  const cutoff = addDays(today, -retentionDays);

  const { toInProgress, toClosed } = await closeExpiredMissions();

  const rolledUpRows = await rollupBefore(today);

  const deletedClickEvents = await prisma.$executeRaw`
    DELETE FROM "click_events" e
    WHERE e."dayKey" < ${cutoff}::date
      AND EXISTS (SELECT 1 FROM "click_daily" d WHERE d."linkId" = e."linkId" AND d."dayKey" = e."dayKey")`;
  const deletedVisitorHashes = await prisma.$executeRaw`
    DELETE FROM "click_daily_visitors" WHERE "dayKey" < ${cutoff}::date`;

  // 만료 후 30일까지는 API 장애 시 대체 응답으로 쓰고, 그 뒤 삭제
  const { count: deletedKeywordCache } = await prisma.keywordCache.deleteMany({
    where: { expiresAt: { lt: addDays(clock.now(), -30) } },
  });
  const { count: deletedShareLinks } = await prisma.reportShareLink.deleteMany({
    where: { OR: [{ expiresAt: { lt: addDays(clock.now(), -30) } }, { revokedAt: { lt: addDays(clock.now(), -30) } }] },
  });

  const deletedResetTokens = await deleteExpiredResetTokens();

  return {
    today: formatDay(today),
    cutoff: formatDay(cutoff),
    missionsToInProgress: toInProgress,
    missionsClosed: toClosed,
    rolledUpRows,
    deletedClickEvents,
    deletedVisitorHashes,
    deletedKeywordCache,
    deletedShareLinks,
    deletedResetTokens,
  };
}
