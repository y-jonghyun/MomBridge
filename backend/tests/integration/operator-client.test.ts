import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createOperator, createParticipant } from '../helpers/factory';
import { sendAlimTalk } from '../../src/utils/sms';

jest.mock('../../src/utils/sms', () => ({
  sendAlimTalk: jest.fn().mockResolvedValue(undefined),
  sendSMS: jest.fn().mockResolvedValue(undefined),
}));

/**
 * 운영자가 가입하지 않은 가게를 대신 등록한다.
 * 만들어지는 계정은 로그인할 수 없고, 메일·알림톡도 받지 않는다.
 */
describeDb('가게 대신 등록', () => {
  let operator: Awaited<ReturnType<typeof createOperator>>;

  beforeEach(async () => {
    await resetDb();
    (sendAlimTalk as jest.Mock).mockClear();
    operator = await createOperator();
  });
  afterAll(() => prisma.$disconnect());

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const shop = (over: Record<string, unknown> = {}) => ({
    businessName: '합정 브런치하우스',
    businessCategory: 'CAFE',
    regionSi: '서울특별시',
    regionGu: '마포구',
    regionDong: '합정동',
    address: '서울시 마포구 합정동 1',
    ...over,
  });
  const create = (token: string, body: Record<string, unknown> = shop()) =>
    request(app).post('/api/v1/operator/clients').set(auth(token)).send(body);

  it('운영자만 만들 수 있다', async () => {
    const client = await createClient();
    const participant = await createParticipant();

    expect((await create(client.token)).status).toBe(403);
    expect((await create(participant.token)).status).toBe(403);
    expect(await prisma.clientProfile.count()).toBe(1); // createClient가 만든 것뿐
  });

  it('가게와 계정을 함께 만들고 기록을 남긴다', async () => {
    const res = await create(operator.token);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      businessName: '합정 브런치하우스',
      regionSi: '서울특별시', regionGu: '마포구', regionDong: '합정동',
      managedByOperator: true,
    });

    const profile = await prisma.clientProfile.findUniqueOrThrow({
      where: { id: res.body.data.id }, include: { user: true },
    });
    expect(profile.user.role).toBe('CLIENT');
    expect(profile.user.managedByOperator).toBe(true);
    // 메일이 가지 않는 내부용 주소
    expect(profile.user.email).toMatch(/^shop-[0-9a-f-]+@managed\.mombridge\.local$/);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'OPERATOR_CLIENT_CREATE' } });
    expect(audit.actorId).toBe(operator.user.id);
    expect(audit.targetId).toBe(profile.id);
  });

  it('시·도와 가게 이름이 없으면 거절한다', async () => {
    expect((await create(operator.token, shop({ businessName: '' }))).status).toBe(400);
    expect((await create(operator.token, shop({ regionSi: '' }))).status).toBe(400);
    expect((await create(operator.token, shop({ regionGu: '' }))).status).toBe(400);
  });

  describe('만들어진 계정', () => {
    it('로그인할 수 없다', async () => {
      const created = await create(operator.token);
      const email = (await prisma.clientProfile.findUniqueOrThrow({
        where: { id: created.body.data.id }, include: { user: true },
      })).user.email;

      for (const password of ['', 'LocalDev1234!', 'managed']) {
        const res = await request(app).post('/api/v1/auth/login').send({ email, password });
        expect(res.status).toBe(401);
      }
    });

    it('비밀번호 재설정 메일을 받지 않는다', async () => {
      const created = await create(operator.token);
      const email = (await prisma.clientProfile.findUniqueOrThrow({
        where: { id: created.body.data.id }, include: { user: true },
      })).user.email;

      const res = await request(app).post('/api/v1/auth/password-reset/request').send({ email });
      // 가입 여부를 알려주지 않으므로 응답은 같고, 토큰이 만들어지지 않는 것으로 확인한다
      expect([200, 202, 503]).toContain(res.status);
      await new Promise(r => setTimeout(r, 300));
      expect(await prisma.passwordResetToken.count()).toBe(0);
    });

    it('결제 링크·알림톡을 받지 않는다', async () => {
      const created = await create(operator.token, shop({ contactPhone: '010-5555-6666' }));

      const mission = await request(app).post('/api/v1/missions').set(auth(operator.token)).send({
        clientProfileId: created.body.data.id,
        title: '합정 브런치 체험', description: '브런치를 드시고 후기를 남겨 주세요',
        category: 'SNS', regionSi: '서울특별시', regionGu: '마포구',
        rewardAmount: 30000, maxParticipants: 5,
        startDate: '2026-11-01', endDate: '2026-11-10', submissionDeadline: '2026-11-20',
        sendPaymentLink: true,
      });

      expect(mission.status).toBe(201);
      expect(sendAlimTalk).not.toHaveBeenCalled();
    });

    it('그 가게로 올린 미션이 공개 목록에 가게 이름·지역으로 보인다', async () => {
      const created = await create(operator.token);
      const mission = await request(app).post('/api/v1/missions').set(auth(operator.token)).send({
        clientProfileId: created.body.data.id,
        title: '합정 브런치 체험', description: '브런치를 드시고 후기를 남겨 주세요',
        category: 'SNS', regionSi: '서울특별시', regionGu: '마포구',
        rewardAmount: 30000, maxParticipants: 5,
        startDate: '2026-11-01', endDate: '2026-11-10', submissionDeadline: '2026-11-20',
      });
      await prisma.mission.update({ where: { id: mission.body.data.id }, data: { status: 'OPEN' } });

      const list = await request(app).get('/api/v1/missions');
      const row = list.body.data.missions.find((m: { id: string }) => m.id === mission.body.data.id);

      expect(row).toBeTruthy();
      expect(row.clientProfile.businessName).toBe('합정 브런치하우스');
      expect(row.regionGu).toBe('마포구');
      // 내부용 주소는 공개 목록에 나가지 않는다
      expect(JSON.stringify(list.body)).not.toContain('managed.mombridge.local');
    });
  });
});
