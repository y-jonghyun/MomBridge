import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant } from '../helpers/factory';

/**
 * 미션 수정.
 * - 운영자는 모든 미션, 고객사는 본인 미션만
 * - 신청이 들어온 뒤에는 체험단원에게 불리한 변경을 막는다
 * - 결제된 미션의 금액·인원은 둘 다 막는다
 * - 등록과 같은 날짜 순서 규칙을 쓴다
 * - 바꾼 내용은 AuditLog에 남고, 일정·방문 안내가 바뀌면 선정된 사람에게 알린다
 */
describeDb('미션 수정', () => {
  let operator: Awaited<ReturnType<typeof createOperator>>;
  let client: Awaited<ReturnType<typeof createClient>>;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** 수정 화면이 보내는 본문 (등록과 같은 칸) */
  const body = (over: Record<string, unknown> = {}) => ({
    title: '테스트 미션', description: '설명', category: 'SNS',
    regionSi: '서울특별시', regionGu: '마포구',
    rewardAmount: 30000, maxParticipants: 5,
    startDate: '2026-11-01', endDate: '2026-11-10', submissionDeadline: '2026-11-20',
    ...over,
  });

  beforeEach(async () => {
    await resetDb();
    operator = await createOperator();
    client = await createClient();
    await prisma.clientProfile.update({
      where: { id: client.profile.id },
      data: { businessCategory: 'CAFE', address: '서울시 마포구 1', regionSi: '서울특별시', regionGu: '마포구' },
    });
  });
  afterAll(() => prisma.$disconnect());

  async function mission(extra: Record<string, unknown> = {}) {
    return createMission(client.profile.id, {
      title: '테스트 미션', description: '설명', category: 'SNS',
      regionSi: '서울특별시', regionGu: '마포구',
      rewardAmount: 30000, maxParticipants: 5,
      startDate: new Date('2026-11-01'), endDate: new Date('2026-11-10'),
      submissionDeadline: new Date('2026-11-20'),
      ...extra,
    });
  }

  const put = (token: string, id: string, data: Record<string, unknown>) =>
    request(app).put(`/api/v1/missions/${id}/edit`).set(auth(token)).send(data);
  const get = (token: string, id: string) =>
    request(app).get(`/api/v1/missions/${id}/edit`).set(auth(token));

  describe('권한', () => {
    it('남의 미션은 고칠 수 없다', async () => {
      const m = await mission();
      const other = await createClient('남의 가게');

      expect((await get(other.token, m.id)).status).toBe(403);
      expect((await put(other.token, m.id, body({ title: '가로채기' }))).status).toBe(403);

      const after = await prisma.mission.findUniqueOrThrow({ where: { id: m.id } });
      expect(after.title).toBe('테스트 미션');
    });

    it('체험단원은 고칠 수 없다', async () => {
      const m = await mission();
      const p = await createParticipant();
      expect((await put(p.token, m.id, body())).status).toBe(403);
    });

    it('로그인하지 않으면 볼 수도 없다', async () => {
      const m = await mission();
      expect((await request(app).get(`/api/v1/missions/${m.id}/edit`)).status).toBe(401);
    });

    it('본인 미션과 운영자는 된다', async () => {
      const m = await mission();
      expect((await get(client.token, m.id)).status).toBe(200);
      expect((await get(operator.token, m.id)).status).toBe(200);
    });
  });

  describe('신청 전', () => {
    it('고객사도 거의 다 고칠 수 있다', async () => {
      const m = await mission();
      const res = await put(client.token, m.id, body({
        title: '바꾼 제목', category: 'VISIT', rewardAmount: 20000, maxParticipants: 3,
        regionGu: '강남구', endDate: '2026-11-05', submissionDeadline: '2026-11-12',
      }));

      expect(res.status).toBe(200);
      expect(res.body.data.changed).toEqual(expect.arrayContaining([
        'title', 'category', 'regionGu', 'rewardAmount', 'maxParticipants', 'endDate', 'submissionDeadline',
      ]));

      const after = await prisma.mission.findUniqueOrThrow({ where: { id: m.id } });
      expect(after.title).toBe('바꾼 제목');
      expect(Number(after.rewardAmount)).toBe(20000);
      expect(after.maxParticipants).toBe(3);
    });

    it('규칙표에 잠긴 칸이 없다', async () => {
      const m = await mission();
      const res = await get(client.token, m.id);
      expect(Object.values(res.body.data.rules).every((r) => !(r as { locked: boolean }).locked)).toBe(true);
      expect(res.body.data.applicationCount).toBe(0);
    });
  });

  describe('신청이 들어온 뒤', () => {
    async function withApplication() {
      const m = await mission();
      const p = await createParticipant();
      await prisma.application.create({ data: { missionId: m.id, participantId: p.profile.id, status: 'PENDING' } });
      return { m, p };
    }

    it('안내성 항목은 고칠 수 있다', async () => {
      const { m } = await withApplication();
      const res = await put(client.token, m.id, body({
        description: '설명을 더 자세히 적었어요',
        visitGuide: '체험 가능: 평일 11:00~19:00',
        visitHours: '평일 11:00~19:00',
        visitAddress: '서울시 마포구 합정동 123 2층',
      }));

      expect(res.status).toBe(200);
      expect(res.body.data.changed).toEqual(expect.arrayContaining(['description', 'visitGuide', 'visitHours', 'visitAddress']));
    });

    it('유형 변경과 제목·지역 변경은 막는다', async () => {
      const { m } = await withApplication();

      const category = await put(client.token, m.id, body({ category: 'VISIT' }));
      expect(category.status).toBe(422);
      expect(category.body.error.code).toBe('FIELD_LOCKED');
      expect(category.body.error.message).toContain('미션 유형');

      expect((await put(client.token, m.id, body({ title: '바꾼 제목' }))).status).toBe(422);
      expect((await put(client.token, m.id, body({ regionGu: '강남구' }))).status).toBe(422);

      const after = await prisma.mission.findUniqueOrThrow({ where: { id: m.id } });
      expect(after.category).toBe('SNS');
      expect(after.title).toBe('테스트 미션');
    });

    it('보상·인원은 줄일 수 없고 늘릴 수는 있다', async () => {
      const { m } = await withApplication();

      const down = await put(client.token, m.id, body({ rewardAmount: 20000 }));
      expect(down.status).toBe(422);
      expect(down.body.error.message).toContain('보상 금액');

      expect((await put(client.token, m.id, body({ maxParticipants: 3 }))).status).toBe(422);

      const up = await put(client.token, m.id, body({ rewardAmount: 50000, maxParticipants: 8 }));
      expect(up.status).toBe(200);
      const after = await prisma.mission.findUniqueOrThrow({ where: { id: m.id } });
      expect(Number(after.rewardAmount)).toBe(50000);
      expect(after.maxParticipants).toBe(8);
    });

    it('일정은 앞당길 수 없고 미룰 수는 있다', async () => {
      const { m } = await withApplication();

      const earlier = await put(client.token, m.id, body({ endDate: '2026-11-05', submissionDeadline: '2026-11-12' }));
      expect(earlier.status).toBe(422);
      expect(earlier.body.error.message).toContain('신청 마감일');

      const later = await put(client.token, m.id, body({ endDate: '2026-11-15', submissionDeadline: '2026-11-25' }));
      expect(later.status).toBe(200);
    });

    it('운영자는 신청이 있어도 다 고칠 수 있다', async () => {
      const { m } = await withApplication();
      const res = await put(operator.token, m.id, body({
        category: 'VISIT', title: '운영자가 고침', rewardAmount: 10000, endDate: '2026-11-05', submissionDeadline: '2026-11-08',
      }));
      expect(res.status).toBe(200);
      const after = await prisma.mission.findUniqueOrThrow({ where: { id: m.id } });
      expect(after.category).toBe('VISIT');
      expect(after.title).toBe('운영자가 고침');
    });

    it('규칙표가 잠김과 이유를 알려준다', async () => {
      const { m } = await withApplication();
      const res = await get(client.token, m.id);

      expect(res.body.data.applicationCount).toBe(1);
      expect(res.body.data.rules.category).toMatchObject({ locked: true });
      expect(res.body.data.rules.category.reason).toContain('신청한 분들');
      expect(res.body.data.rules.rewardAmount).toMatchObject({ locked: false, onlyBetter: true });
      expect(res.body.data.rules.description).toMatchObject({ locked: false, onlyBetter: false });
    });
  });

  describe('결제된 미션', () => {
    it('금액·인원은 고객사도 운영자도 못 바꾼다', async () => {
      const m = await mission({ paymentStatus: 'PAID' });

      for (const token of [client.token, operator.token]) {
        const res = await put(token, m.id, body({ rewardAmount: 50000 }));
        expect(res.status).toBe(422);
        expect(res.body.error.message).toContain('보상 금액');
      }

      const after = await prisma.mission.findUniqueOrThrow({ where: { id: m.id } });
      expect(Number(after.rewardAmount)).toBe(30000);
    });

    it('운영자에게는 결제 확인이 필요하다고 알려준다', async () => {
      const m = await mission({ paymentStatus: 'PAID' });

      const forOperator = await get(operator.token, m.id);
      expect(forOperator.body.data.rules.rewardAmount.reason).toContain('결제 확인이 필요');

      const forClient = await get(client.token, m.id);
      expect(forClient.body.data.rules.rewardAmount.reason).toContain('운영자에게 문의');
    });

    it('금액 말고 다른 칸은 고칠 수 있다', async () => {
      const m = await mission({ paymentStatus: 'PAID' });
      const res = await put(client.token, m.id, body({ description: '설명만 고쳐요' }));
      expect(res.status).toBe(200);
      expect(res.body.data.changed).toEqual(['description']);
    });
  });

  describe('종료된 미션', () => {
    it('고객사도 운영자도 수정할 수 없다', async () => {
      const m = await mission({ status: 'CLOSED' });

      for (const token of [client.token, operator.token]) {
        const res = await put(token, m.id, body({ description: '설명을 고쳐요' }));
        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('MISSION_CLOSED');
        expect(res.body.error.message).toContain('상태를 되돌린 뒤');
      }

      // 아무것도 바뀌지 않는다
      const saved = await prisma.mission.findUniqueOrThrow({ where: { id: m.id } });
      expect(saved.description).toBe('설명');
    });

    it('수정 화면은 종료됐다는 것을 함께 알려 준다', async () => {
      const m = await mission({ status: 'CLOSED' });

      const res = await get(operator.token, m.id);

      expect(res.status).toBe(200);
      expect(res.body.data.closed).toBe(true);
    });

    it('종료가 아니면 지금처럼 고칠 수 있다', async () => {
      const m = await mission({ status: 'REVIEWING' });
      expect((await put(client.token, m.id, body({ description: '설명을 고쳐요' }))).status).toBe(200);
    });
  });

  describe('검사는 등록과 같다', () => {
    it('날짜 순서가 어긋나면 막는다', async () => {
      const m = await mission();
      const res = await put(client.token, m.id, body({ endDate: '2026-10-25' }));
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('신청 마감일은 신청 시작일 이후여야 합니다');
    });

    it('선정 발표일도 순서를 본다', async () => {
      const m = await mission();
      const res = await put(client.token, m.id, body({ announceDate: '2026-11-05' }));
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('선정 발표일은 신청 마감일 이후여야 합니다');
    });

    it('가게 정보가 덜 차면 고객사는 고칠 수 없다', async () => {
      const m = await mission();
      await prisma.clientProfile.update({
        where: { id: client.profile.id },
        data: { businessName: '', address: '' },
      });

      const res = await put(client.token, m.id, body({ description: '설명' }));
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('STORE_INCOMPLETE');
    });
  });

  describe('기록과 알림', () => {
    it('바뀐 값의 전·후를 AuditLog에 남긴다', async () => {
      const m = await mission();
      await put(client.token, m.id, body({ title: '바꾼 제목', rewardAmount: 40000 }));

      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'MISSION_UPDATE', targetId: m.id } });
      expect(log.actorId).toBe(client.user.id);
      expect(log.before).toMatchObject({ title: '테스트 미션', rewardAmount: 30000 });
      expect(log.after).toMatchObject({ title: '바꾼 제목', rewardAmount: 40000 });
      // 바뀌지 않은 칸은 기록하지 않는다
      expect(Object.keys(log.after as object).sort()).toEqual(['rewardAmount', 'title']);
    });

    it('바뀐 게 없으면 기록도 남기지 않는다', async () => {
      const m = await mission();
      const res = await put(client.token, m.id, body());
      expect(res.status).toBe(200);
      expect(res.body.data.changed).toEqual([]);
      expect(await prisma.auditLog.count({ where: { action: 'MISSION_UPDATE' } })).toBe(0);
    });

    it('일정·방문 안내가 바뀌면 선정된 체험단원에게 알린다', async () => {
      const m = await mission();
      const picked = await createParticipant('선정된 사람');
      const waiting = await createParticipant('대기 중인 사람');
      await prisma.application.create({ data: { missionId: m.id, participantId: picked.profile.id, status: 'APPROVED' } });
      await prisma.application.create({ data: { missionId: m.id, participantId: waiting.profile.id, status: 'PENDING' } });

      const res = await put(client.token, m.id, body({
        endDate: '2026-11-15', submissionDeadline: '2026-11-25', visitGuide: '예약 후 방문해 주세요',
      }));
      expect(res.status).toBe(200);
      expect(res.body.data.notified).toBe(1);

      const notes = await prisma.notification.findMany({ where: { resourceId: m.id } });
      expect(notes).toHaveLength(1);
      expect(notes[0].userId).toBe(picked.user.id);
      expect(notes[0].title).toBe('미션 안내가 바뀌었어요');
      expect(notes[0].body).toContain('신청 마감일');
      expect(notes[0].body).toContain('방문·예약 안내');
    });

    it('운영자가 불리하게 바꾸면 확인 표시를 함께 남긴다', async () => {
      const m = await mission();
      const applicant = await createParticipant();
      await prisma.application.create({ data: { missionId: m.id, participantId: applicant.profile.id, status: 'PENDING' } });

      const res = await put(operator.token, m.id, body({ rewardAmount: 20000, endDate: '2026-11-05' })
      );
      expect(res.status).toBe(200);
      expect(res.body.data.unfavorable).toEqual(['endDate', 'rewardAmount']);

      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'MISSION_UPDATE', targetId: m.id } });
      expect(log.after).toMatchObject({
        rewardAmount: 20000,
        _unfavorable: {
          fields: ['endDate', 'rewardAmount'],
          labels: ['신청 마감일', '보상 금액'],
          affected: 1,
          acknowledged: false,
        },
      });
    });

    it('화면에서 확인을 받고 보내면 확인했다고 남는다', async () => {
      const m = await mission();
      const applicant = await createParticipant();
      await prisma.application.create({ data: { missionId: m.id, participantId: applicant.profile.id, status: 'PENDING' } });

      const res = await put(operator.token, m.id, body({ maxParticipants: 3, acknowledgeUnfavorable: true }));
      expect(res.status).toBe(200);

      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'MISSION_UPDATE', targetId: m.id } });
      expect(log.after).toMatchObject({ maxParticipants: 3, _unfavorable: { acknowledged: true } });
      // 확인 여부는 기록에만 남고 저장할 칸으로 새지 않는다
      const saved = await prisma.mission.findUniqueOrThrow({ where: { id: m.id } });
      expect(saved.maxParticipants).toBe(3);
    });

    it('좋아지는 쪽으로 바꾸거나 신청이 없으면 확인 표시가 없다', async () => {
      const applied = await mission();
      const applicant = await createParticipant();
      await prisma.application.create({ data: { missionId: applied.id, participantId: applicant.profile.id, status: 'PENDING' } });
      await put(operator.token, applied.id, body({ rewardAmount: 50000, endDate: '2026-11-15' }));
      const better = await prisma.auditLog.findFirstOrThrow({ where: { targetId: applied.id } });
      expect(Object.keys(better.after as object)).not.toContain('_unfavorable');

      // 신청이 없으면 줄여도 불리한 사람이 없다
      const empty = await mission({ title: '신청 없는 미션' });
      await put(operator.token, empty.id, body({ title: '신청 없는 미션', rewardAmount: 10000 }));
      const none = await prisma.auditLog.findFirstOrThrow({ where: { targetId: empty.id } });
      expect(Object.keys(none.after as object)).not.toContain('_unfavorable');
    });

    it('안내와 상관없는 칸만 바뀌면 알리지 않는다', async () => {
      const m = await mission();
      const picked = await createParticipant();
      await prisma.application.create({ data: { missionId: m.id, participantId: picked.profile.id, status: 'APPROVED' } });

      // 신청이 있으므로 안내성 항목만 고친다
      const res = await put(client.token, m.id, body({ description: '설명만 고쳐요' }));
      expect(res.status).toBe(200);
      expect(res.body.data.notified).toBe(0);
      expect(await prisma.notification.count()).toBe(0);
    });
  });
});
