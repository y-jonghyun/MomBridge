import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createParticipant } from '../helpers/factory';
import { clock } from '../../src/lib/clock';
import { clearSettingsCache } from '../../src/modules/settings/settings';
import { lookupKeywords, resetKeywordToolState, setKeywordToolAdapter } from '../../src/modules/keywords/keyword.service';
import { KeywordToolAdapter, KeywordToolRateLimitError, RawRelKeyword } from '../../src/modules/keywords/keyword-tool';
import { MockKeywordToolAdapter } from '../../src/modules/keywords/mock.adapter';

class FakeAdapter implements KeywordToolAdapter {
  readonly source = 'mock' as const;
  calls = 0;
  fail: Error | null = null;
  constructor(private readonly rows: RawRelKeyword[]) {}
  async fetchRelated(): Promise<RawRelKeyword[]> {
    this.calls++;
    if (this.fail) throw this.fail;
    return this.rows;
  }
}

const ROWS: RawRelKeyword[] = [
  { relKeyword: '망원동카페', monthlyPcQcCnt: '320', monthlyMobileQcCnt: 1800, compIdx: '낮음' },
  { relKeyword: '카페', monthlyPcQcCnt: 90000, monthlyMobileQcCnt: 400000, compIdx: '높음' },
  { relKeyword: '망원동브런치', monthlyPcQcCnt: '< 10', monthlyMobileQcCnt: '< 10', compIdx: '낮음' },
];

describeDb('키워드 추천 · 캐시', () => {
  let fake: FakeAdapter;

  beforeEach(async () => {
    await resetDb();
    clearSettingsCache();
    resetKeywordToolState();
    clock.set(null);
    fake = new FakeAdapter(ROWS);
    setKeywordToolAdapter(fake);
  });
  afterAll(async () => {
    setKeywordToolAdapter(new MockKeywordToolAdapter());
    clock.set(null);
    await prisma.$disconnect();
  });

  it('필수 2: a cache hit does not call the API; it is called again only after the TTL (default 7 days)', async () => {
    const t0 = new Date('2026-10-21T00:00:00Z');
    clock.set(() => t0);
    const first = await lookupKeywords(['망원동카페']);
    expect(first.cached).toBe(false);
    expect(fake.calls).toBe(1);

    clock.set(() => new Date(t0.getTime() + 6 * 86400000));
    const second = await lookupKeywords([' 망원동 카페 ']); // 공백 정규화 후 같은 키
    expect(second.cached).toBe(true);
    expect(second.rows).toEqual(first.rows);
    expect(fake.calls).toBe(1);

    clock.set(() => new Date(t0.getTime() + 7 * 86400000 + 1000));
    await lookupKeywords(['망원동카페']);
    expect(fake.calls).toBe(2);
  });

  it('serves the expired cache marked stale when the API rate-limits, and pauses further calls', async () => {
    const t0 = new Date('2026-10-01T00:00:00Z');
    clock.set(() => t0);
    await lookupKeywords(['망원동카페']);
    clock.set(() => new Date(t0.getTime() + 8 * 86400000));
    fake.fail = new KeywordToolRateLimitError();
    const res = await lookupKeywords(['망원동카페']);
    expect(res).toMatchObject({ cached: true, stale: true });
    expect(fake.calls).toBe(2);
    // 429 이후에는 차단 시간 동안 호출하지 않는다
    await lookupKeywords(['망원동카페']);
    expect(fake.calls).toBe(2);
  });

  it('returns 503 when the API fails and nothing is cached', async () => {
    fake.fail = new Error('boom');
    const client = await createClient();
    const res = await request(app).post('/api/v1/keywords/recommend').set('Authorization', `Bearer ${client.token}`)
      .send({ category: '카페', region: '서울 마포구 망원동' });
    expect(res.status).toBe(503);
  });

  it('POST /keywords/recommend ranks region+category keywords first and shows "<10" as low volume', async () => {
    const client = await createClient();
    const res = await request(app).post('/api/v1/keywords/recommend').set('Authorization', `Bearer ${client.token}`)
      .send({ category: '카페', region: '서울 마포구 망원동', product: '브런치' });
    expect(res.status).toBe(200);
    const { rows, hints } = res.body.data;
    expect(hints).toEqual(['망원동카페', '망원동브런치', '카페', '브런치']);
    expect(rows[0]).toMatchObject({ keyword: '망원동카페', isRegionCategory: true, compIdx: 'low' });
    expect(rows.find((r: any) => r.keyword === '망원동브런치')).toMatchObject({ monthlyPc: null, monthlyPcLow: true });
  });

  it('participants cannot call the keyword tool', async () => {
    const p = await createParticipant();
    const res = await request(app).post('/api/v1/keywords/recommend').set('Authorization', `Bearer ${p.token}`)
      .send({ category: '카페', region: '망원동' });
    expect(res.status).toBe(403);
  });

  it('saves one main + sub keywords for the owner only, enforcing the sub-keyword limit', async () => {
    const client = await createClient();
    const mission = await createMission(client.profile.id);
    const url = `/api/v1/client/missions/${mission.id}/keywords`;
    const ok = await request(app).put(url).set('Authorization', `Bearer ${client.token}`).send({
      main: { keyword: '망원동카페', monthlyPcQc: 320, monthlyMobileQc: 1800, compIdx: 'low' },
      subs: [{ keyword: '망원동브런치', isLowVolume: true }, { keyword: '망원동카페' }],
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.main.keyword).toBe('망원동카페');
    expect(ok.body.data.subs.map((s: any) => s.keyword)).toEqual(['망원동브런치']); // 메인과 겹치는 서브는 제외

    const tooMany = await request(app).put(url).set('Authorization', `Bearer ${client.token}`).send({
      main: { keyword: 'a' }, subs: ['b', 'c', 'd', 'e', 'f', 'g'].map(keyword => ({ keyword })),
    });
    expect(tooMany.status).toBe(400);

    const other = await createClient('다른 광고주');
    const denied = await request(app).put(url).set('Authorization', `Bearer ${other.token}`).send({ main: { keyword: 'x' } });
    expect(denied.status).toBe(404);
  });
});
