import { prisma } from '../../config/database';
import { clock } from '../../lib/clock';

/**
 * 데모·임시 미션 정리 (운영 스크립트 scripts/cleanup-missions가 사용).
 * - hide: 목록에서 내리고 종료 처리(isVisible=false, CLOSED). 되돌릴 수 있다 → 데모 미션 기본 처리
 * - delete: 완전 삭제. 결제됐거나 제출·정산 기록이 있는 미션은 거부한다
 */
export interface MissionRow {
  id: string;
  title: string;
  business: string;
  status: string;
  paymentStatus: string;
  isVisible: boolean;
  createdAt: Date;
  endDate: Date;
  applications: number;
  submissions: number;
}

export async function listMissions(): Promise<MissionRow[]> {
  const rows = await prisma.mission.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, title: true, status: true, paymentStatus: true, isVisible: true, createdAt: true, endDate: true,
      clientProfile: { select: { businessName: true } },
      _count: { select: { applications: true, submissions: true } },
    },
  });
  return rows.map(r => ({
    id: r.id, title: r.title, business: r.clientProfile.businessName, status: r.status, paymentStatus: r.paymentStatus,
    isVisible: r.isVisible, createdAt: r.createdAt, endDate: r.endDate,
    applications: r._count.applications, submissions: r._count.submissions,
  }));
}

/** 결제 대기 상태로 오래 남은 임시저장 미션 (고객사가 결제하지 않고 떠난 것) */
export async function staleUnpaidDrafts(olderThanDays: number): Promise<string[]> {
  const before = new Date(clock.now().getTime() - olderThanDays * 86400_000);
  const rows = await prisma.mission.findMany({
    where: { status: 'DRAFT', paymentStatus: 'PENDING', createdAt: { lt: before } },
    select: { id: true },
  });
  return rows.map(r => r.id);
}

export async function hideMissions(ids: string[]): Promise<number> {
  const { count } = await prisma.mission.updateMany({
    where: { id: { in: ids } },
    data: { isVisible: false, status: 'CLOSED', closedAt: clock.now() },
  });
  return count;
}

export interface DeleteCheck { id: string; ok: boolean; reason?: string }

export async function checkDeletable(ids: string[]): Promise<DeleteCheck[]> {
  const rows = await prisma.mission.findMany({
    where: { id: { in: ids } },
    select: { id: true, paymentStatus: true, _count: { select: { submissions: true } } },
  });
  const found = new Map(rows.map(r => [r.id, r]));
  return ids.map(id => {
    const r = found.get(id);
    if (!r) return { id, ok: false, reason: '없는 미션' };
    if (r.paymentStatus === 'PAID') return { id, ok: false, reason: '결제된 미션 — 환불·기록 보관 대상이라 삭제하지 않음 (hide 사용)' };
    if (r._count.submissions > 0) return { id, ok: false, reason: `제출 ${r._count.submissions}건이 있음 (hide 사용)` };
    return { id, ok: true };
  });
}

/** 삭제 가능한 미션만 지원 기록과 함께 삭제한다 (키워드·추적 링크·클릭·공유 링크는 DB에서 함께 삭제됨) */
export async function deleteMissions(ids: string[]): Promise<{ deleted: string[]; refused: DeleteCheck[] }> {
  const checks = await checkDeletable(ids);
  const deletable = checks.filter(c => c.ok).map(c => c.id);
  if (deletable.length) {
    await prisma.$transaction([
      prisma.application.deleteMany({ where: { missionId: { in: deletable } } }),
      prisma.mission.deleteMany({ where: { id: { in: deletable }, paymentStatus: { not: 'PAID' }, submissions: { none: {} } } }),
    ]);
  }
  return { deleted: deletable, refused: checks.filter(c => !c.ok) };
}
