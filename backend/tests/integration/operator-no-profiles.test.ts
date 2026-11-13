import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createOperator, createParticipant, createUser } from '../helpers/factory';
import { addDays, formatDay, kstDayKey } from '../../src/lib/clock';

/**
 * 운영자 계정에는 참여자·가게 프로필이 생기지 않는다 (2026-11-13 초기화 리허설에서 발견한 문제).
 * - /participant 경로는 참여자만, /client 경로는 가게만 받는다. 운영자는 403, 프로필도 생기지 않는다
 * - 참여자·가게 계정은 지금처럼 처음 들어올 때 프로필이 생긴다
 * - 예전에 운영자 계정에 생긴 프로필은 가게 목록·대행 등록·새 미션 알림에 섞이지 않는다
 * - 운영자의 가게 대신 등록 · 미션 대신 등록은 그대로 동작한다
 */
jest.mock('../../src/utils/sms', () => ({
  sendAlimTalk: jest.fn().mockResolvedValue(undefined),
  sendSMS: jest.fn().mockResolvedValue(undefined),
}));

const day = (offset: number) => formatDay(addDays(kstDayKey(), offset));
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const missionBody = (clientProfileId?: string) => ({
  ...(clientProfileId && { clientProfileId }),
  title: '합정 브런치 체험', description: '브런치를 드시고 후기를 남겨 주세요',
  category: 'VISIT', regionSi: '서울특별시', regionGu: '마포구', regionDong: '합정동',
  rewardAmount: 30000, maxParticipants: 5,
  startDate: day(1), endDate: day(30), submissionDeadline: day(40),
});

/** 예전 코드로 운영자 계정에 이미 생겨 있는 프로필 (운영 DB에 남아 있을 수 있는 모양) */
async function legacyOperatorProfiles(userId: string) {
  const participant = await prisma.participantProfile.create({
    data: { userId, regionSi: '서울특별시', regionGu: '마포구', newMissionAlerts: true },
  });
  const client = await prisma.clientProfile.create({
    data: { userId, businessName: '운영자 테스트 가게', category: '카페', address: '서울', regionSi: '서울특별시', regionGu: '마포구' },
  });
  return { participant, client };
}

describeDb('운영자 계정에는 참여자·가게 프로필을 만들지 않는다', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  describe('1) 운영자는 참여자·가게 경로에서 403이고 프로필이 생기지 않는다', () => {
    it('참여자 경로 (/participant/*)', async () => {
      const op = await createOperator();
      const calls = [
        request(app).get('/api/v1/participant/applications'),
        request(app).get('/api/v1/participant/payouts'),
        request(app).get('/api/v1/participant/bookmarks/ids'),
        request(app).get('/api/v1/participant/payout-schedule'),
        request(app).get('/api/v1/participant/profile'),
        request(app).put('/api/v1/participant/profile').send({ regionSi: '서울특별시', regionGu: '마포구' }),
        request(app).put('/api/v1/participant/profile/alerts').send({ newMissionAlerts: true }),
      ];
      for (const call of calls) {
        const res = await call.set(auth(op.token));
        expect(res.status).toBe(403);
      }
      expect(await prisma.participantProfile.count({ where: { userId: op.user.id } })).toBe(0);
    });

    it('가게 경로 (/client/*)', async () => {
      const op = await createOperator();
      const client = await createClient();
      const { id: missionId } = await prisma.mission.create({
        data: { ...missionBody(), clientProfileId: client.profile.id, status: 'OPEN', campaignCode: 'opnp0001',
          startDate: new Date(), endDate: new Date(Date.now() + 9e8), submissionDeadline: new Date(Date.now() + 1e9) } as never,
      });
      const calls = [
        request(app).get('/api/v1/client/profile'),
        request(app).put('/api/v1/client/profile').send({ businessName: '가게' }),
        request(app).get('/api/v1/client/missions'),
        request(app).get(`/api/v1/client/missions/${missionId}/applications`),
        request(app).get(`/api/v1/client/missions/${missionId}/report`),
      ];
      for (const call of calls) {
        const res = await call.set(auth(op.token));
        expect(res.status).toBe(403);
      }
      expect(await prisma.clientProfile.count({ where: { userId: op.user.id } })).toBe(0);
    });
  });

  describe('2) 참여자·가게 계정은 지금처럼 프로필이 생긴다', () => {
    it('프로필 없는 참여자가 처음 들어오면 참여자 프로필이 생긴다', async () => {
      const p = await createUser('PARTICIPANT', '새 참여자');
      expect(await prisma.participantProfile.count({ where: { userId: p.user.id } })).toBe(0);
      const res = await request(app).get('/api/v1/participant/profile').set(auth(p.token));
      expect(res.status).toBe(200);
      expect(await prisma.participantProfile.count({ where: { userId: p.user.id } })).toBe(1);
    });

    it('프로필 없는 가게가 처음 들어오면 가게 프로필이 생긴다', async () => {
      const c = await createUser('CLIENT', '새 가게');
      const res = await request(app).get('/api/v1/client/profile').set(auth(c.token));
      expect(res.status).toBe(200);
      expect(await prisma.clientProfile.count({ where: { userId: c.user.id } })).toBe(1);
    });
  });

  describe('3) 운영자 화면의 목록에 운영자 계정이 섞이지 않는다 (예전에 생긴 프로필이 있어도)', () => {
    it('가게 목록 (= 미션 대신 등록의 가게 선택지)', async () => {
      const op = await createOperator();
      const client = await createClient('진짜 가게');
      await legacyOperatorProfiles(op.user.id);
      const res = await request(app).get('/api/v1/operator/clients').set(auth(op.token));
      expect(res.status).toBe(200);
      const ids = (res.body.data as { id: string }[]).map(c => c.id);
      expect(ids).toEqual([client.profile.id]);
    });

    it('참여자 목록 · 가게 계정 목록', async () => {
      const op = await createOperator();
      const p = await createParticipant();
      const c = await createClient();
      await legacyOperatorProfiles(op.user.id);
      const participants = await request(app).get('/api/v1/operator/users?role=PARTICIPANT').set(auth(op.token));
      expect((participants.body.data.users ?? participants.body.data).map((u: { id: string }) => u.id)).toEqual([p.user.id]);
      const clients = await request(app).get('/api/v1/operator/users?role=CLIENT').set(auth(op.token));
      expect((clients.body.data.users ?? clients.body.data).map((u: { id: string }) => u.id)).toEqual([c.user.id]);
    });

    it('새 미션 알림 대상', async () => {
      const op = await createOperator();
      const p = await createParticipant();
      await prisma.participantProfile.update({ where: { id: p.profile.id }, data: { regionSi: '서울특별시', newMissionAlerts: true } });
      await legacyOperatorProfiles(op.user.id); // 운영자에게도 마포구 + 알림 켬
      const client = await createClient();
      const created = await request(app).post('/api/v1/missions').set(auth(op.token)).send(missionBody(client.profile.id));
      expect(created.status).toBe(201);
      await request(app).patch(`/api/v1/operator/missions/${created.body.data.id}/status`).set(auth(op.token)).send({ status: 'OPEN' });
      const alerted = await prisma.notification.findMany({ where: { type: 'MISSION_OPEN' }, select: { userId: true } });
      expect(alerted.map(n => n.userId)).toEqual([p.user.id]);
    });
  });

  describe('운영자의 대신 등록은 그대로 동작한다 (이 경로들은 /operator · /missions를 쓴다)', () => {
    it('가게 대신 등록 → 그 가게로 미션 대신 등록 → 수정 화면 열기 → 모집 시작', async () => {
      const op = await createOperator();
      const shop = await request(app).post('/api/v1/operator/clients').set(auth(op.token)).send({
        businessName: '합정 브런치하우스', businessCategory: 'CAFE', regionSi: '서울특별시', regionGu: '마포구',
        regionDong: '합정동', address: '서울시 마포구 합정동 1',
      });
      expect(shop.status).toBe(201);

      const mission = await request(app).post('/api/v1/missions').set(auth(op.token)).send(missionBody(shop.body.data.id));
      expect(mission.status).toBe(201);
      expect(mission.body.data.clientProfileId).toBe(shop.body.data.id);

      const edit = await request(app).get(`/api/v1/missions/${mission.body.data.id}/edit`).set(auth(op.token));
      expect(edit.status).toBe(200);
      const open = await request(app).patch(`/api/v1/operator/missions/${mission.body.data.id}/status`).set(auth(op.token)).send({ status: 'OPEN' });
      expect(open.status).toBe(200);

      // 이 과정에서 운영자 계정에 프로필이 생기지 않았다
      expect(await prisma.clientProfile.count({ where: { userId: op.user.id } })).toBe(0);
      expect(await prisma.participantProfile.count({ where: { userId: op.user.id } })).toBe(0);
    });

    it('미션 대신 등록은 가게를 꼭 골라야 하고, 가게 계정의 프로필이어야 한다', async () => {
      const op = await createOperator();
      const { client: legacy } = await legacyOperatorProfiles(op.user.id);
      // 비워 두면 예전에는 운영자 자신의 프로필로 등록됐다
      const none = await request(app).post('/api/v1/missions').set(auth(op.token)).send(missionBody());
      expect(none.status).toBe(400);
      expect(JSON.stringify(none.body)).toContain('가게를 골라');
      const own = await request(app).post('/api/v1/missions').set(auth(op.token)).send(missionBody(legacy.id));
      expect(own.status).toBe(400);
      expect(await prisma.mission.count()).toBe(0);
    });
  });
});
