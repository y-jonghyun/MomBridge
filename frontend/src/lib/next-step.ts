import { journeySteps, type JourneyStep } from '@/components/participant/MissionJourney';

/**
 * 로그인 후 홈의 '내 미션 다음 단계' 카드에 무엇을 올릴지 정한다.
 * 내 활동 '진행 중'과 같은 기준·같은 단계(journeySteps)를 쓴다 — 두 화면이 서로 다른 말을 하지 않게.
 */

export interface AppLike {
  id: string;
  missionId: string;
  status: string;
  createdAt: string;
  reviewedAt?: string | null;
  mission?: { title?: string; status?: string; submissionDeadline?: string | null } | null;
}
export interface SubLike { missionId: string; status: string; revisionCount?: number; maxRevisions?: number }
export interface PayoutLike { status: string; submission?: { missionId?: string } | null }

/** 내 활동 '진행 중'과 같다: 선정됐고, 지급까지 끝나지 않았고, 미션이 종료되지 않은 신청 */
export function activeApplications<A extends AppLike>(apps: A[], payouts: PayoutLike[]): A[] {
  const paid = new Set(payouts.filter(p => p.status === 'COMPLETED').map(p => p.submission?.missionId));
  return apps.filter(a => a.status === 'APPROVED' && !paid.has(a.missionId) && a.mission?.status !== 'CLOSED');
}

/** 가로 단계 막대에 쓰는 짧은 이름 (journeySteps의 다섯 단계와 순서가 같다) */
export const SHORT_LABELS = ['신청', '선정', '후기', '검수', '지급'] as const;

export interface NextStep {
  /** 카드 전체가 가는 곳 */
  href: string;
  title: string;
  /** 왼쪽 위 칩 — 지금 할 일 */
  chip: string;
  /** 오른쪽 위 — "진행 중 2" / "신청 3" */
  count: string;
  steps: JourneyStep[];
}

const dDay = (deadline: string | null | undefined, now: Date) => {
  if (!deadline) return null;
  const d = Math.ceil((new Date(deadline).getTime() - now.getTime()) / 86400000);
  return d < 0 ? null : d === 0 ? 'D-Day' : `D-${d}`;
};

export function pickNextStep({
  applications, submissions, payouts, payoutDay = null, now = new Date(),
}: {
  applications: AppLike[];
  submissions: SubLike[];
  payouts: PayoutLike[];
  payoutDay?: string | null;
  now?: Date;
}): NextStep | null {
  const subBy = new Map(submissions.map(s => [s.missionId, s]));
  const active = activeApplications(applications, payouts);

  if (active.length > 0) {
    // 지금 손이 가야 하는 것부터: 수정 요청 → 아직 제출 전(마감이 가까운 순) → 검수 중 → 지급 대기
    const rank = (a: AppLike) => {
      const s = subBy.get(a.missionId);
      if (s?.status === 'REVISION' && (s.revisionCount ?? 0) < (s.maxRevisions ?? 0)) return 0;
      if (!s || s.status === 'REVISION' || s.status === 'REJECTED') return 1;
      if (s.status === 'SUBMITTED') return 2;
      return 3;
    };
    const due = (a: AppLike) => (a.mission?.submissionDeadline ? new Date(a.mission.submissionDeadline).getTime() : Infinity);
    const a = [...active].sort((x, y) => rank(x) - rank(y) || due(x) - due(y))[0];
    const s = subBy.get(a.missionId);
    const revisionLeft = s?.status === 'REVISION' && (s.revisionCount ?? 0) < (s.maxRevisions ?? 0);
    const paidOut = payouts.some(p => p.status === 'COMPLETED' && p.submission?.missionId === a.missionId);
    const steps = journeySteps({
      appliedAt: a.createdAt,
      selectedAt: a.reviewedAt,
      deadline: a.mission?.submissionDeadline,
      submissionStatus: s?.status ?? null,
      revisionLeft,
      payoutCompleted: paidOut,
      payoutDay,
      now,
    });
    const current = steps.findIndex(st => st.state === 'current');
    const d = dDay(a.mission?.submissionDeadline, now);
    const chip =
      revisionLeft ? '후기 수정 요청'
      : current === 2 ? (d ? `후기 제출 · ${d}` : '후기 제출')
      : current === 3 ? '검수 중'
      : current === 4 ? (payoutDay ? `보상 지급 · ${payoutDay}` : '보상 지급')
      : SHORT_LABELS[Math.max(0, current)];
    return { href: '/participant', title: a.mission?.title ?? '미션', chip, count: `진행 중 ${active.length}`, steps };
  }

  // 선정 전인 신청만 있으면 가장 최근 신청을 '선정 대기'로 보여 준다
  const pending = applications
    .filter(a => a.status === 'PENDING')
    .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
  if (pending.length > 0) {
    const a = pending[0];
    const monthDay = (v: string) => { const t = new Date(v); return `${t.getMonth() + 1}월 ${t.getDate()}일`; };
    const steps: JourneyStep[] = [
      { label: '신청', detail: monthDay(a.createdAt), state: 'done' },
      { label: '선정', state: 'current' },
      { label: '방문하고 후기 제출', state: 'todo' },
      { label: '검수', state: 'todo' },
      { label: '보상 지급', state: 'todo' },
    ];
    return { href: '/participant?tab=applications', title: a.mission?.title ?? '미션', chip: '선정 대기', count: `신청 ${pending.length}`, steps };
  }
  return null;
}
