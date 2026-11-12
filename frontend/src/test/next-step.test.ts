import { describe, expect, it } from 'vitest';
import { activeApplications, pickNextStep, type AppLike } from '@/lib/next-step';

/**
 * 로그인 후 홈 '내 미션 다음 단계' 카드 — 무엇을 올리고 칩에 뭐라고 쓰는지.
 * 단계는 내 활동 여정(journeySteps)과 같다.
 */

const NOW = new Date('2026-11-12T09:00:00+09:00');
const app = (id: string, over: Partial<AppLike> & { deadline?: string | null; title?: string } = {}): AppLike => ({
  id, missionId: `m${id}`, status: 'APPROVED', createdAt: '2026-11-01T00:00:00Z', reviewedAt: '2026-11-03T00:00:00Z',
  mission: { title: over.title ?? `미션 ${id}`, status: 'IN_PROGRESS', submissionDeadline: over.deadline ?? null },
  ...over,
});
const pick = (applications: AppLike[], submissions: any[] = [], payouts: any[] = [], payoutDay: string | null = null) =>
  pickNextStep({ applications, submissions, payouts, payoutDay, now: NOW });

describe('진행 중 신청 고르기', () => {
  it('내 활동과 같은 기준: 선정됨 · 지급 안 끝남 · 미션 안 닫힘', () => {
    const apps = [
      app('1'),
      app('2', { status: 'PENDING' }),
      app('3', { mission: { status: 'CLOSED' } }),
      app('4'),
    ];
    const active = activeApplications(apps, [{ status: 'COMPLETED', submission: { missionId: 'm4' } }]);
    expect(active.map(a => a.id)).toEqual(['1']);
  });
});

describe('다음 단계 카드', () => {
  it('아무 신청도 없으면 카드가 없다', () => {
    expect(pick([])).toBeNull();
  });

  it('후기 제출 전이면 칩에 후기 제출과 D-n', () => {
    const s = pick([app('1', { deadline: '2026-11-14T09:00:00+09:00', title: '한결 베이커리' })])!;
    expect(s.title).toBe('한결 베이커리');
    expect(s.chip).toBe('후기 제출 · D-2');
    expect(s.count).toBe('진행 중 1');
    expect(s.href).toBe('/participant');
    expect(s.steps.map(x => x.state)).toEqual(['done', 'done', 'current', 'todo', 'todo']);
  });

  it('마감이 지났으면 D-n 없이 후기 제출', () => {
    expect(pick([app('1', { deadline: '2026-11-10T00:00:00Z' })])!.chip).toBe('후기 제출');
  });

  it('검수 중 · 보상 지급 단계', () => {
    expect(pick([app('1')], [{ missionId: 'm1', status: 'SUBMITTED' }])!.chip).toBe('검수 중');
    const paid = pick([app('1')], [{ missionId: 'm1', status: 'APPROVED' }], [], '12월 10일')!;
    expect(paid.chip).toBe('보상 지급 · 12월 10일');
    expect(paid.steps.map(x => x.state)).toEqual(['done', 'done', 'done', 'done', 'current']);
  });

  it('여러 개면 손이 가야 하는 것부터: 수정 요청 → 제출 전(마감 가까운 순) → 검수 중', () => {
    const apps = [
      app('1', { deadline: '2026-11-20T00:00:00Z' }),
      app('2', { deadline: '2026-11-15T00:00:00Z' }),
      app('3'),
      app('4'),
    ];
    const subs = [
      { missionId: 'm3', status: 'SUBMITTED' },
      { missionId: 'm4', status: 'REVISION', revisionCount: 0, maxRevisions: 2 },
    ];
    const first = pick(apps, subs)!;
    expect(first.title).toBe('미션 4');
    expect(first.chip).toBe('후기 수정 요청');
    expect(first.count).toBe('진행 중 4');

    expect(pick(apps.slice(0, 3), subs)!.title).toBe('미션 2');
  });

  it('선정 전 신청만 있으면 가장 최근 신청을 선정 대기로', () => {
    const s = pick([
      app('1', { status: 'PENDING', createdAt: '2026-11-05T00:00:00Z', title: '먼저 신청' }),
      app('2', { status: 'PENDING', createdAt: '2026-11-08T00:00:00Z', title: '나중 신청' }),
      app('3', { status: 'REJECTED' }),
    ])!;
    expect(s.title).toBe('나중 신청');
    expect(s.chip).toBe('선정 대기');
    expect(s.count).toBe('신청 2');
    expect(s.href).toBe('/participant?tab=applications');
    expect(s.steps.map(x => x.state)).toEqual(['done', 'current', 'todo', 'todo', 'todo']);
  });
});
