import { prisma } from '../../config/database';
import { clock, kstDayKey } from '../../lib/clock';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 모집 마감 기준 시각 = 오늘(KST) 0시. 마감일(endDate)이 이보다 앞이면 마감일 하루가 다 지난 것이다.
 * 날짜 입력은 UTC 자정으로 저장되므로(예: 10/1 → 2026-10-01T00:00Z) 마감일 당일에는 계속 모집중으로 보인다.
 */
export function recruitingCutoff(now: Date = clock.now()): Date {
  return new Date(kstDayKey(now).getTime() - KST_OFFSET_MS);
}

export interface ExpiredMissionsResult {
  /** 지원자(승인·대기)가 있어 진행 단계로 넘긴 미션 */
  toInProgress: string[];
  /** 지원자가 없어 종료한 미션 */
  toClosed: string[];
}

/**
 * 마감일이 지난 '모집중'(OPEN) 미션의 상태를 바꾼다. 여러 번 실행해도 결과가 같다.
 * - 승인됐거나 심사 대기 중인 지원이 있으면 → IN_PROGRESS (체험·제출 단계. 제출은 미션 상태와 무관하게 승인된 지원자만 가능)
 * - 없으면 → CLOSED (closedAt 기록)
 * OPEN이 아닌 미션(DRAFT·진행중·종료)은 건드리지 않는다.
 */
export async function closeExpiredMissions(now: Date = clock.now()): Promise<ExpiredMissionsResult> {
  const cutoff = recruitingCutoff(now);
  const expired = await prisma.mission.findMany({
    where: { status: 'OPEN', endDate: { lt: cutoff } },
    select: { id: true, _count: { select: { applications: { where: { status: { in: ['APPROVED', 'PENDING'] } } } } } },
  });
  const toInProgress = expired.filter(m => m._count.applications > 0).map(m => m.id);
  const toClosed = expired.filter(m => m._count.applications === 0).map(m => m.id);

  // status: 'OPEN' 조건을 다시 걸어, 조회 후 운영자가 상태를 바꾼 미션은 덮어쓰지 않는다
  if (toInProgress.length) {
    await prisma.mission.updateMany({ where: { id: { in: toInProgress }, status: 'OPEN' }, data: { status: 'IN_PROGRESS' } });
  }
  if (toClosed.length) {
    await prisma.mission.updateMany({ where: { id: { in: toClosed }, status: 'OPEN' }, data: { status: 'CLOSED', closedAt: now } });
  }
  return { toInProgress, toClosed };
}
