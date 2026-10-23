import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission } from '../helpers/factory';

/** 업종·엄마 시간 태그 필터 */
describeDb('미션 목록 필터', () => {
  beforeEach(async () => {
    await resetDb();
    const client = await createClient();
    await createMission(client.profile.id, { title: '카페 평일낮', businessCategory: 'CAFE', momTags: ['WEEKDAY_DAY'] });
    await createMission(client.profile.id, { title: '맛집 주말', businessCategory: 'FOOD', momTags: ['WEEKEND_OK', 'KID_FRIENDLY'] });
    await createMission(client.profile.id, { title: '분류 없음' });
  });
  afterAll(() => prisma.$disconnect());

  const titles = async (query: string) => {
    const res = await request(app).get(`/api/v1/missions${query}`);
    expect(res.status).toBe(200);
    return res.body.data.missions.map((m: { title: string }) => m.title).sort();
  };

  it('업종으로 거른다', async () => {
    expect(await titles('?businessCategory=CAFE')).toEqual(['카페 평일낮']);
    // 업종을 고르지 않은 미션은 어떤 업종 필터에도 걸리지 않는다
    expect(await titles('?businessCategory=KIDS')).toEqual([]);
  });

  it('엄마 시간 태그는 하나라도 맞으면 보여준다', async () => {
    expect(await titles('?momTags=WEEKDAY_DAY')).toEqual(['카페 평일낮']);
    expect(await titles('?momTags=WEEKDAY_DAY,KID_FRIENDLY')).toEqual(['맛집 주말', '카페 평일낮']);
  });

  it('업종과 태그를 함께 쓰면 둘 다 맞아야 한다', async () => {
    expect(await titles('?businessCategory=FOOD&momTags=WEEKEND_OK')).toEqual(['맛집 주말']);
    expect(await titles('?businessCategory=CAFE&momTags=WEEKEND_OK')).toEqual([]);
  });

  it('모르는 값은 무시하고 전체를 보여준다', async () => {
    expect(await titles('?businessCategory=NOPE&momTags=NOPE')).toEqual(['맛집 주말', '분류 없음', '카페 평일낮']);
  });

  it('목록 응답에 업종·태그·사진이 함께 온다', async () => {
    const res = await request(app).get('/api/v1/missions?businessCategory=FOOD');
    const [m] = res.body.data.missions;
    expect(m.businessCategory).toBe('FOOD');
    expect(m.momTags).toEqual(['WEEKEND_OK', 'KID_FRIENDLY']);
    expect(Array.isArray(m.images)).toBe(true);
  });
});
