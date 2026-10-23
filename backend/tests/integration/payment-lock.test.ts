import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator } from '../helpers/factory';

/**
 * 사업자등록 전 공개 — 고객사 결제는 잠그고, 미션은 운영자 대행 등록(결제 면제)으로만 받는다.
 * 잠금은 backend/src/config/features.ts의 CLIENT_PAYMENT_ENABLED 한 줄로 되돌린다.
 */
describeDb('공개 전 결제 잠금', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('고객사는 결제하고 등록할 수 없다', async () => {
    const client = await createClient();
    const fetchSpy = jest.spyOn(global, 'fetch');

    const res = await request(app).post('/api/v1/missions/pay-and-create')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        title: '미션', description: '설명', category: 'SNS', rewardAmount: 30000, maxParticipants: 5,
        regionSi: '서울', regionGu: '마포구',
        startDate: '2026-11-01', endDate: '2026-11-14', submissionDeadline: '2026-11-10',
        paymentKey: 'pk', orderId: 'oid', amount: 150000,
      });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PAYMENT_DISABLED');
    // 결제사에 요청이 나가지 않는다
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await prisma.mission.count()).toBe(0);
    fetchSpy.mockRestore();
  });

  it('결제 대기 미션에 돈을 낼 수도 없다', async () => {
    const client = await createClient();
    const mission = await createMission(client.profile.id, { paymentStatus: 'PENDING' });

    const res = await request(app).patch(`/api/v1/missions/${mission.id}/pay`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ paymentKey: 'pk', orderId: 'oid', amount: 150000 });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PAYMENT_DISABLED');
    const after = await prisma.mission.findUniqueOrThrow({ where: { id: mission.id } });
    expect(after.paymentStatus).toBe('PENDING');
  });

  it('운영자 대행 등록(결제 면제)은 그대로 된다', async () => {
    const operator = await createOperator();
    const client = await createClient();

    const res = await request(app).post('/api/v1/missions')
      .set('Authorization', `Bearer ${operator.token}`)
      .send({
        clientProfileId: client.profile.id,
        title: '대행 등록 미션', description: '설명', category: 'SNS',
        rewardAmount: 30000, maxParticipants: 5, regionSi: '서울', regionGu: '마포구',
        startDate: '2026-11-01', endDate: '2026-11-14', submissionDeadline: '2026-11-10',
      });

    expect(res.status).toBe(201);
    const mission = await prisma.mission.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(mission.paymentStatus).toBe('WAIVED');
  });
});
