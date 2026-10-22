import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createOperator } from '../helpers/factory';

const body = {
  title: '방문 미션', description: '설명', category: 'VISIT', regionSi: '충청북도', regionGu: '청주시',
  maxParticipants: 3, rewardAmount: 20000, startDate: '2026-11-01', endDate: '2026-11-10', submissionDeadline: '2026-11-20',
};

describeDb('미션 방문·예약 안내', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('stores the guide per mission and returns it on the detail page; empty means none', async () => {
    const op = await createOperator();
    const client = await createClient();
    const create = (extra: object) => request(app).post('/api/v1/missions').set('Authorization', `Bearer ${op.token}`)
      .send({ ...body, clientProfileId: client.profile.id, ...extra });

    const withGuide = await create({ visitGuide: '체험 가능: 주말 10:00~18:00\n전화 예약 후 방문' });
    expect(withGuide.status).toBe(201);
    const detail = await request(app).get(`/api/v1/missions/${withGuide.body.data.id}`);
    expect(detail.body.data.visitGuide).toBe('체험 가능: 주말 10:00~18:00\n전화 예약 후 방문');

    const empty = await create({ visitGuide: '' });
    expect((await request(app).get(`/api/v1/missions/${empty.body.data.id}`)).body.data.visitGuide).toBeNull();

    expect((await create({ visitGuide: 'x'.repeat(2001) })).status).toBe(400);
  });
});
