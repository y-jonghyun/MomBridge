import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant, createApprovedApplication } from '../helpers/factory';

describe('trust proxy', () => {
  it('uses the client IP forwarded by one proxy hop', async () => {
    const probe = require('express')();
    probe.set('trust proxy', app.get('trust proxy'));
    probe.get('/ip', (req: any, res: any) => res.send(req.ip));
    const res = await request(probe).get('/ip').set('X-Forwarded-For', '203.0.113.7');
    expect(res.text).toBe('203.0.113.7');
  });
});

describeDb('입력 검증', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  const missionBody = {
    title: '카페 체험', description: '설명', category: 'REVIEW', regionSi: '서울', regionGu: '마포구',
    rewardAmount: 30000, maxParticipants: 5, requirements: '',
    startDate: '2026-11-01', endDate: '2026-11-30', submissionDeadline: '2026-11-25',
  };

  it('ignores server-controlled fields when an operator creates a mission', async () => {
    const op = await createOperator();
    const client = await createClient();
    const res = await request(app).post('/api/v1/missions').set('Authorization', `Bearer ${op.token}`)
      .send({ ...missionBody, clientProfileId: client.profile.id, status: 'OPEN', paymentStatus: 'PAID', viewCount: 999 });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.paymentStatus).toBe('WAIVED');
    expect(res.body.data.viewCount).toBe(0);
  });

  it('rejects invalid mission input with 400', async () => {
    const op = await createOperator();
    const res = await request(app).post('/api/v1/missions').set('Authorization', `Bearer ${op.token}`)
      .send({ ...missionBody, category: 'NOPE' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses pay-and-create when the amount does not match reward × participants, before calling Toss', async () => {
    const client = await createClient();
    const fetchSpy = jest.spyOn(global, 'fetch');
    const res = await request(app).post('/api/v1/missions/pay-and-create').set('Authorization', `Bearer ${client.token}`)
      .send({ ...missionBody, paymentKey: 'pk', orderId: 'oid', amount: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AMOUNT_MISMATCH');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('refuses paying an existing mission with the wrong amount', async () => {
    const client = await createClient();
    const mission = await createMission(client.profile.id, { paymentStatus: 'PENDING' });
    const res = await request(app).patch(`/api/v1/missions/${mission.id}/pay`).set('Authorization', `Bearer ${client.token}`)
      .send({ paymentKey: 'pk', orderId: 'oid', amount: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AMOUNT_MISMATCH');
  });
});

describeDb('재제출', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  async function setup() {
    const client = await createClient();
    const mission = await createMission(client.profile.id);
    const p = await createParticipant();
    const application = await createApprovedApplication(mission.id, p.profile.id);
    const op = await createOperator();
    return { mission, p, application, op };
  }

  it('returns 409 instead of a server error on a second POST', async () => {
    const { mission, p } = await setup();
    const body = { missionId: mission.id, snsPostUrl: 'https://blog.naver.com/a/1' };
    expect((await request(app).post('/api/v1/submissions').set('Authorization', `Bearer ${p.token}`).send(body)).status).toBe(201);
    const second = await request(app).post('/api/v1/submissions').set('Authorization', `Bearer ${p.token}`).send(body);
    expect(second.status).toBe(409);
  });

  it('allows resubmitting after a revision request, up to maxRevisions', async () => {
    const { mission, p, op } = await setup();
    const created = await request(app).post('/api/v1/submissions').set('Authorization', `Bearer ${p.token}`)
      .send({ missionId: mission.id, snsPostUrl: 'https://blog.naver.com/a/1' });
    const id = created.body.data.id;

    // 수정 요청 전에는 재제출 불가
    expect((await request(app).patch(`/api/v1/submissions/${id}/resubmit`).set('Authorization', `Bearer ${p.token}`).send({})).status).toBe(409);

    for (let i = 0; i < 2; i++) {
      await request(app).patch(`/api/v1/submissions/${id}/review`).set('Authorization', `Bearer ${op.token}`)
        .send({ status: 'REVISION', reviewNote: '수정해 주세요' }).expect(200);
      const r = await request(app).patch(`/api/v1/submissions/${id}/resubmit`).set('Authorization', `Bearer ${p.token}`)
        .send({ snsPostUrl: `https://blog.naver.com/a/${i + 2}` });
      expect(r.status).toBe(200);
      expect(r.body.data.status).toBe('SUBMITTED');
      expect(r.body.data.revisionCount).toBe(i + 1);
    }

    await request(app).patch(`/api/v1/submissions/${id}/review`).set('Authorization', `Bearer ${op.token}`)
      .send({ status: 'REVISION' }).expect(200);
    const over = await request(app).patch(`/api/v1/submissions/${id}/resubmit`).set('Authorization', `Bearer ${p.token}`).send({});
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('REVISION_LIMIT');
  });

  it("does not let a participant resubmit someone else's submission", async () => {
    const { mission, p, op } = await setup();
    const created = await request(app).post('/api/v1/submissions').set('Authorization', `Bearer ${p.token}`)
      .send({ missionId: mission.id });
    await request(app).patch(`/api/v1/submissions/${created.body.data.id}/review`).set('Authorization', `Bearer ${op.token}`)
      .send({ status: 'REVISION' });
    const other = await createParticipant('다른 사람');
    const r = await request(app).patch(`/api/v1/submissions/${created.body.data.id}/resubmit`).set('Authorization', `Bearer ${other.token}`).send({});
    expect(r.status).toBe(404);
  });

  it('does not create a second payout when an approved submission is reviewed again', async () => {
    const { mission, p, op } = await setup();
    const created = await request(app).post('/api/v1/submissions').set('Authorization', `Bearer ${p.token}`).send({ missionId: mission.id });
    const id = created.body.data.id;
    await request(app).patch(`/api/v1/submissions/${id}/review`).set('Authorization', `Bearer ${op.token}`).send({ status: 'APPROVED' }).expect(200);
    const again = await request(app).patch(`/api/v1/submissions/${id}/review`).set('Authorization', `Bearer ${op.token}`).send({ status: 'APPROVED' });
    expect(again.status).toBe(409);
    expect(await prisma.payout.count()).toBe(1);
  });
});
