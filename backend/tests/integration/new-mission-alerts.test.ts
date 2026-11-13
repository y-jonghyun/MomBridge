import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant } from '../helpers/factory';

/**
 * 새 미션 알림 (app-feel PR 7) — 앱 안 알림함으로만 보낸다.
 * 같은 시·구에서 알림을 켠 참여자에게, 미션이 열릴 때 한 번.
 */
describeDb('새 미션 알림', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  const alertsOf = (userId: string) =>
    prisma.notification.findMany({ where: { userId, type: 'MISSION_OPEN' }, orderBy: { createdAt: 'asc' } });

  async function setup() {
    const op = await createOperator();
    const client = await createClient('한결');
    // 마포구에서 켠 사람 · 마포구에서 안 켠 사람 · 다른 구에서 켠 사람 · 서울시로 저장된(예전 표기) 마포구에서 켠 사람
    const on = await createParticipant('켠 사람');
    const off = await createParticipant('안 켠 사람');
    const other = await createParticipant('다른 구');
    const oldSpelling = await createParticipant('예전 표기');
    await prisma.participantProfile.update({ where: { id: on.profile.id }, data: { regionSi: '서울특별시', newMissionAlerts: true } });
    await prisma.participantProfile.update({ where: { id: other.profile.id }, data: { regionSi: '서울특별시', regionGu: '용산구', newMissionAlerts: true } });
    await prisma.participantProfile.update({ where: { id: oldSpelling.profile.id }, data: { regionSi: '서울시', newMissionAlerts: true } });
    const mission = await createMission(client.profile.id, {
      status: 'DRAFT', title: '라테 시음 후기', regionSi: '서울특별시', regionGu: '마포구', regionDong: '합정동',
    });
    const open = (status = 'OPEN', path = `/api/v1/operator/missions/${mission.id}/status`) =>
      request(app).patch(path).set('Authorization', `Bearer ${op.token}`).send({ status });
    return { op, client, on, off, other, oldSpelling, mission, open };
  }

  it('미션이 열리면 같은 시·구에서 알림을 켠 참여자에게만 알림함으로 보낸다', async () => {
    const { on, off, other, oldSpelling, mission, open } = await setup();
    expect((await open()).status).toBe(200);

    const [a] = await alertsOf(on.user.id);
    expect(a).toMatchObject({
      title: '마포구 합정동에 새 미션이 열렸어요',
      body: '[한결 가게] 라테 시음 후기',
      resourceId: mission.id, resourceType: 'mission', isRead: false,
    });
    expect(await alertsOf(oldSpelling.user.id)).toHaveLength(1);
    expect(await alertsOf(off.user.id)).toHaveLength(0);
    expect(await alertsOf(other.user.id)).toHaveLength(0);
  });

  it('닫았다 다시 열어도, 두 경로로 열어도 미션마다 한 번만', async () => {
    const { on, mission, open } = await setup();
    await open();
    await open('DRAFT');
    await open();
    await open('OPEN', `/api/v1/missions/${mission.id}/status`);
    expect(await alertsOf(on.user.id)).toHaveLength(1);
    expect((await prisma.mission.findUnique({ where: { id: mission.id } }))!.openAlertedAt).not.toBeNull();
  });

  it('목록에 안 보이는 미션·모집이 끝난 미션은 알리지 않는다', async () => {
    const { on, client, op } = await setup();
    const hidden = await createMission(client.profile.id, { status: 'DRAFT', isVisible: false });
    const ended = await createMission(client.profile.id, { status: 'DRAFT', endDate: new Date(Date.now() - 3 * 86400000) });
    for (const m of [hidden, ended]) {
      await request(app).patch(`/api/v1/operator/missions/${m.id}/status`).set('Authorization', `Bearer ${op.token}`).send({ status: 'OPEN' });
    }
    expect(await alertsOf(on.user.id)).toHaveLength(0);
  });

  it('탈퇴·비활성 계정에는 보내지 않는다', async () => {
    const { on, open } = await setup();
    await prisma.user.update({ where: { id: on.user.id }, data: { isActive: false } });
    await open();
    expect(await alertsOf(on.user.id)).toHaveLength(0);
  });

  it('이미 열려 있던 미션은 배포 뒤에도 알림이 한꺼번에 나가지 않는다 (열리는 순간에만 보낸다)', async () => {
    const { on, client } = await setup();
    await createMission(client.profile.id, { status: 'OPEN' });
    await request(app).get('/api/v1/missions');
    expect(await alertsOf(on.user.id)).toHaveLength(0);
  });

  describe('알림 받기 켜기·끄기', () => {
    it('본인 프로필에서 켜고 끈다. 기본은 꺼짐', async () => {
      const p = await createParticipant();
      const get = () => request(app).get('/api/v1/participant/profile').set('Authorization', `Bearer ${p.token}`);
      const put = (v: boolean) => request(app).put('/api/v1/participant/profile/alerts').set('Authorization', `Bearer ${p.token}`).send({ newMissionAlerts: v });
      expect((await get()).body.data.newMissionAlerts).toBe(false);
      expect((await put(true)).body.data).toMatchObject({ newMissionAlerts: true, regionGu: '마포구' });
      expect((await get()).body.data.newMissionAlerts).toBe(true);
      expect((await put(false)).body.data.newMissionAlerts).toBe(false);
    });

    it('활동 지역이 없으면 켤 수 없다', async () => {
      const p = await createParticipant('지역 없음');
      await prisma.participantProfile.update({ where: { id: p.profile.id }, data: { regionSi: '', regionGu: '' } });
      const res = await request(app).put('/api/v1/participant/profile/alerts').set('Authorization', `Bearer ${p.token}`).send({ newMissionAlerts: true });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('활동 지역을 먼저');
    });

    it('참여자만 쓸 수 있다', async () => {
      const c = await createClient();
      const res = await request(app).put('/api/v1/participant/profile/alerts').set('Authorization', `Bearer ${c.token}`).send({ newMissionAlerts: true });
      expect(res.status).toBe(403);
    });
  });
});
