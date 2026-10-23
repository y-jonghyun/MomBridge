import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createParticipant } from '../helpers/factory';

/** 찜은 본인 것만 보고 바꿀 수 있다 */
describeDb('찜', () => {
  let me: Awaited<ReturnType<typeof createParticipant>>;
  let other: Awaited<ReturnType<typeof createParticipant>>;
  let missionA: string;
  let missionB: string;

  beforeEach(async () => {
    await resetDb();
    me = await createParticipant('나');
    other = await createParticipant('남');
    const client = await createClient();
    missionA = (await createMission(client.profile.id, { title: 'A 미션' })).id;
    missionB = (await createMission(client.profile.id, { title: 'B 미션' })).id;
  });
  afterAll(() => prisma.$disconnect());

  const put = (token: string, missionId: string) =>
    request(app).put(`/api/v1/participant/bookmarks/${missionId}`).set('Authorization', `Bearer ${token}`);
  const del = (token: string, missionId: string) =>
    request(app).delete(`/api/v1/participant/bookmarks/${missionId}`).set('Authorization', `Bearer ${token}`);
  const list = (token: string) =>
    request(app).get('/api/v1/participant/bookmarks').set('Authorization', `Bearer ${token}`);
  const ids = (token: string) =>
    request(app).get('/api/v1/participant/bookmarks/ids').set('Authorization', `Bearer ${token}`);

  it('찜하고 풀 수 있고, 두 번 눌러도 한 건만 남는다', async () => {
    expect((await put(me.token, missionA)).status).toBe(200);
    expect((await put(me.token, missionA)).status).toBe(200); // 같은 요청을 또 보내도 오류가 아니다
    expect(await prisma.bookmark.count()).toBe(1);

    expect((await ids(me.token)).body.data).toEqual([missionA]);

    expect((await del(me.token, missionA)).status).toBe(200);
    expect((await del(me.token, missionA)).status).toBe(200); // 없는 것을 지워도 오류가 아니다
    expect(await prisma.bookmark.count()).toBe(0);
  });

  it('내 찜만 보이고, 남의 찜은 지울 수 없다', async () => {
    await put(me.token, missionA);
    await put(other.token, missionB);

    const mine = await list(me.token);
    expect(mine.body.data.map((m: { id: string }) => m.id)).toEqual([missionA]);
    expect(JSON.stringify(mine.body)).not.toContain('B 미션');

    // 남의 찜을 지우려 해도 내 것만 지워진다 (남의 행은 그대로)
    expect((await del(me.token, missionB)).status).toBe(200);
    expect(await prisma.bookmark.count({ where: { participantId: other.profile.id } })).toBe(1);
  });

  it('로그인하지 않으면 찜할 수 없다', async () => {
    expect((await request(app).put(`/api/v1/participant/bookmarks/${missionA}`)).status).toBe(401);
    expect((await request(app).get('/api/v1/participant/bookmarks')).status).toBe(401);
    expect(await prisma.bookmark.count()).toBe(0);
  });

  it('없는 미션은 찜할 수 없다', async () => {
    const res = await put(me.token, '00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
    expect(await prisma.bookmark.count()).toBe(0);
  });

  it('목록은 카드에 필요한 것만 주고 최근 찜이 먼저 온다', async () => {
    await put(me.token, missionA);
    await put(me.token, missionB);

    const res = await list(me.token);
    expect(res.body.data.map((m: { id: string }) => m.id)).toEqual([missionB, missionA]);
    expect(Object.keys(res.body.data[0]).sort()).toEqual([
      'bookmarkedAt', 'businessCategory', 'category', 'clientProfile', 'currentCount', 'description',
      'endDate', 'id', 'maxParticipants', 'momTags', 'regionDong', 'regionGu', 'regionSi',
      'rewardAmount', 'status', 'thumbnailUrl', 'title',
    ]);
  });
});
