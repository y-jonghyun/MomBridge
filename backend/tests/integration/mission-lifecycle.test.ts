import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createParticipant } from '../helpers/factory';
import { clock } from '../../src/lib/clock';
import { closeExpiredMissions, recruitingCutoff } from '../../src/modules/missions/mission-lifecycle';

// 날짜 입력은 UTC 자정으로 저장된다 (예: 마감일 10/1 → 2026-10-01T00:00Z)
const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

describe('recruitingCutoff', () => {
  it('is midnight KST of today', () => {
    expect(recruitingCutoff(new Date('2026-10-02T00:30:00+09:00')).toISOString()).toBe('2026-10-01T15:00:00.000Z');
    expect(recruitingCutoff(new Date('2026-10-01T23:59:00+09:00')).toISOString()).toBe('2026-09-30T15:00:00.000Z');
  });
});

describeDb('마감일 지난 모집중 미션', () => {
  beforeEach(resetDb);
  afterEach(() => clock.set(null));
  afterAll(() => prisma.$disconnect());

  async function setup() {
    const client = await createClient();
    const p1 = await createParticipant('지원자1');
    const p2 = await createParticipant('지원자2');
    const base = { startDate: day('2026-09-20'), submissionDeadline: day('2026-10-20') };
    const m = {
      // 마감 지남 + 승인된 지원자 → 진행중
      approved: await createMission(client.profile.id, { ...base, title: 'approved', endDate: day('2026-10-01') }),
      // 마감 지남 + 심사 대기 지원자만 → 진행중 (운영자가 아직 심사하지 않음)
      pending: await createMission(client.profile.id, { ...base, title: 'pending', endDate: day('2026-10-01') }),
      // 마감 지남 + 지원자 없음(거절·취소만) → 종료
      empty: await createMission(client.profile.id, { ...base, title: 'empty', endDate: day('2026-09-25') }),
      // 오늘이 마감일 → 그대로 모집중
      today: await createMission(client.profile.id, { ...base, title: 'today', endDate: day('2026-10-11') }),
      // 이미 종료·임시저장인 미션은 건드리지 않음
      draft: await createMission(client.profile.id, { ...base, title: 'draft', status: 'DRAFT', endDate: day('2026-09-25') }),
    };
    await prisma.application.createMany({
      data: [
        { missionId: m.approved.id, participantId: p1.profile.id, status: 'APPROVED' },
        { missionId: m.pending.id, participantId: p1.profile.id, status: 'PENDING' },
        { missionId: m.empty.id, participantId: p1.profile.id, status: 'REJECTED' },
        { missionId: m.empty.id, participantId: p2.profile.id, status: 'CANCELED' },
      ],
    });
    return { m, p2 };
  }

  const statusOf = async (id: string) => (await prisma.mission.findUniqueOrThrow({ where: { id } }));

  it('moves expired OPEN missions to IN_PROGRESS or CLOSED, idempotently', async () => {
    const { m } = await setup();
    const now = new Date('2026-10-11T03:30:00+09:00');
    clock.set(() => now);

    const result = await closeExpiredMissions();
    expect(result.toInProgress.sort()).toEqual([m.approved.id, m.pending.id].sort());
    expect(result.toClosed).toEqual([m.empty.id]);

    expect((await statusOf(m.approved.id)).status).toBe('IN_PROGRESS');
    expect((await statusOf(m.pending.id)).status).toBe('IN_PROGRESS');
    const closed = await statusOf(m.empty.id);
    expect(closed.status).toBe('CLOSED');
    expect(closed.closedAt?.toISOString()).toBe(now.toISOString());
    expect((await statusOf(m.today.id)).status).toBe('OPEN');
    expect((await statusOf(m.draft.id)).status).toBe('DRAFT');

    expect(await closeExpiredMissions()).toEqual({ toInProgress: [], toClosed: [] });
  });

  it('runs as part of the daily job', async () => {
    const { m } = await setup();
    clock.set(() => new Date('2026-10-12T03:30:00+09:00'));
    const res = await request(app).post('/api/v1/internal/jobs/daily').set('X-Internal-Token', 'test-job-token');
    expect(res.status).toBe(200);
    // 12일에는 11일 마감 미션도 마감 → 지원자 없으니 함께 종료
    expect(res.body.data.missionsClosed.sort()).toEqual([m.empty.id, m.today.id].sort());
    expect(res.body.data.missionsToInProgress).toHaveLength(2);
    expect((await statusOf(m.today.id)).status).toBe('CLOSED');
  });

  it('hides expired missions from the public list and refuses applications even before the job runs', async () => {
    const { m, p2 } = await setup();
    clock.set(() => new Date('2026-10-11T01:00:00+09:00'));
    const list = await request(app).get('/api/v1/missions');
    expect(list.body.data.missions.map((x: { title: string }) => x.title)).toEqual(['today']);
    expect(list.body.data.total).toBe(1);

    const apply = (missionId: string) =>
      request(app).post('/api/v1/submissions/apply').set('Authorization', `Bearer ${p2.token}`).send({ missionId });
    expect((await apply(m.approved.id)).status).toBe(404);
    expect((await apply(m.today.id)).status).toBe(201);
  });
});
