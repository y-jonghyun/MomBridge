import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createParticipant, createTrackingLink } from '../helpers/factory';
import { TrackedRecorder } from '../helpers/recorder';
import { setClickRecorder, DbClickRecorder, visitorCounter } from '../../src/modules/tracking/click-recorder';
import { clearResolveCache } from '../../src/modules/tracking/redirect.routes';
import { clearSettingsCache, setSetting } from '../../src/modules/settings/settings';
import { clock } from '../../src/lib/clock';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';
const DEST = 'https://smartstore.naver.com/myshop/products/123?ref=x';

describeDb('추적 링크 리다이렉트 · 클릭 집계', () => {
  let recorder: TrackedRecorder;

  beforeEach(async () => {
    await resetDb();
    clearResolveCache();
    clearSettingsCache();
    visitorCounter.clear();
    clock.set(null);
    recorder = new TrackedRecorder();
    setClickRecorder(recorder);
  });
  // 응답 뒤 비동기로 남은 기록이 다음 테스트의 DB 초기화와 겹치지 않도록
  afterEach(() => recorder.idle());
  afterAll(async () => {
    setClickRecorder(new DbClickRecorder());
    clock.set(null);
    await prisma.$disconnect();
  });

  async function setup(destinationUrl: string | null = DEST) {
    const client = await createClient();
    const mission = await createMission(client.profile.id, { destinationUrl });
    const p = await createParticipant();
    const { link } = await createTrackingLink(mission.id, p.profile.id);
    return { mission, link };
  }

  /** XFF는 Render 프록시 1단을 흉내 낸다 (trust proxy = 1) */
  const click = (code: string, ip = '203.0.113.7', ua = CHROME, extra: Record<string, string> = {}) =>
    request(app).get(`/r/${code}`).set('X-Forwarded-For', ip).set('User-Agent', ua).set(extra);

  it('redirects 302 to the registered URL with UTM parameters', async () => {
    const { mission, link } = await setup();
    const res = await click(link.code, '203.0.113.7', CHROME, { Referer: 'https://m.blog.naver.com/someone/223456789012?x=1' });
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.location);
    expect(`${loc.origin}${loc.pathname}`).toBe('https://smartstore.naver.com/myshop/products/123');
    expect(loc.searchParams.get('ref')).toBe('x');
    expect(loc.searchParams.get('utm_source')).toBe('mombridge');
    expect(loc.searchParams.get('utm_medium')).toBe('blog');
    expect(loc.searchParams.get('utm_campaign')).toBe(mission.campaignCode);
    expect(loc.searchParams.get('utm_content')).toBe(link.code);
    expect(res.headers['cache-control']).toBe('no-store');
    await recorder.idle();
    const ev = await prisma.clickEvent.findFirstOrThrow();
    expect(ev).toMatchObject({ refererDomain: 'm.blog.naver.com', device: 'PC', isBot: false, isUnique: true });
  });

  it('필수 4: never redirects anywhere but the registered URL, whatever the request carries', async () => {
    const { link } = await setup();
    const attempts = [
      `/r/${link.code}?url=https://evil.com`,
      `/r/${link.code}?next=%2F%2Fevil.com&redirect=https://evil.com`,
      `/r/${link.code}/..%2F..%2Fevil.com`,
      `/r/${link.code}%2F%2Fevil.com`,
    ];
    for (const path of attempts) {
      const res = await request(app).get(path).set('Host', 'evil.com').set('X-Forwarded-Host', 'evil.com').set('User-Agent', CHROME);
      if (res.status === 302) expect(new URL(res.headers.location).host).toBe('smartstore.naver.com');
      else expect(res.status).toBe(404);
      expect(res.headers.location ?? '').not.toContain('evil.com');
    }
  });

  it('필수 4: unknown, malformed or destination-less codes give 404 and no redirect', async () => {
    const { link } = await setup(null);
    for (const code of [link.code, 'AAAAAAAAAAAA', 'short', '../../etc']) {
      const res = await click(code);
      expect(res.status).toBe(404);
      expect(res.headers.location).toBeUndefined();
    }
  });

  it('필수 5: still redirects when recording the click fails', async () => {
    const { link } = await setup();
    const failing = new TrackedRecorder({ record: async () => { throw new Error('db down'); } });
    setClickRecorder(failing);
    const res = await click(link.code);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('smartstore.naver.com');
    await failing.idle();
    expect(await prisma.clickEvent.count()).toBe(0);
  });

  it('필수 5: still redirects when the recorder hangs (response is sent before recording)', async () => {
    const { link } = await setup();
    setClickRecorder({ record: () => new Promise<void>(() => undefined) });
    const res = await click(link.code);
    expect(res.status).toBe(302);
  });

  it('필수 6: counts the same visitor once per day for uniques, every click for totals', async () => {
    const { link } = await setup();
    clock.set(() => new Date('2026-10-21T03:00:00Z'));
    for (let i = 0; i < 3; i++) { await click(link.code); await recorder.idle(); }
    await click(link.code, '203.0.113.7', IPHONE); await recorder.idle(); // 다른 UA = 다른 방문자
    clock.set(() => new Date('2026-10-22T03:00:00Z'));
    await click(link.code); await recorder.idle(); // 다음 날 = 새 고유 방문

    const events = await prisma.clickEvent.findMany({ orderBy: { id: 'asc' } });
    expect(events).toHaveLength(5);
    expect(events.map(e => e.isUnique)).toEqual([true, false, false, true, true]);
  });

  it('필수 7: records bots but excludes them from counts; rules come from settings', async () => {
    const { link } = await setup();
    await click(link.code, '198.51.100.1', 'Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)');
    await click(link.code, '198.51.100.2', 'kakaotalk-scrap/1.0');
    await click(link.code, '198.51.100.3', '');
    await request(app).head(`/r/${link.code}`).set('X-Forwarded-For', '198.51.100.4').set('User-Agent', CHROME);
    await recorder.idle();
    // 설정에 새 규칙 추가 → 즉시 반영
    await setSetting('click.botRules', [{ name: 'custom-preview', pattern: 'MyPreviewBot' }], SYSTEM_ID);
    await click(link.code, '198.51.100.5', 'Mozilla/5.0 MyPreviewBot/2.0');
    await recorder.idle();

    const events = await prisma.clickEvent.findMany();
    expect(events).toHaveLength(5);
    expect(events.every(e => e.isBot && !e.isUnique)).toBe(true);
    expect(events.map(e => e.botRule).sort()).toEqual(['custom-preview', 'empty-ua', 'generic-bot', 'head-request', 'naver-yeti']);
    expect(await prisma.clickDailyVisitor.count()).toBe(0);
  });

  it('필수 8: never stores the raw IP or User-Agent anywhere', async () => {
    const { link } = await setup();
    const ip = '203.0.113.199';
    const ua = 'Mozilla/5.0 (Windows NT 10.0) UniqueAgentMarker/9.9';
    const logs: string[] = [];
    const spies = (['log', 'info', 'warn', 'error'] as const).map(m => jest.spyOn(console, m).mockImplementation((...a) => { logs.push(a.join(' ')); }));
    const out = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => { logs.push(String(chunk)); return true; });
    await click(link.code, ip, ua);
    await recorder.idle();
    spies.forEach(s => s.mockRestore());
    out.mockRestore();

    expect(await prisma.clickEvent.count()).toBe(1);
    // 클릭 관련 테이블 전체를 텍스트로 덤프해 검사
    const dump = JSON.stringify(await Promise.all([
      prisma.$queryRawUnsafe('SELECT * FROM "click_events"'),
      prisma.$queryRawUnsafe('SELECT * FROM "click_daily_visitors"'),
      prisma.$queryRawUnsafe('SELECT * FROM "click_daily"'),
      prisma.$queryRawUnsafe('SELECT * FROM "tracking_links"'),
      prisma.$queryRawUnsafe('SELECT * FROM "audit_logs"'),
    ]), (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(dump).not.toContain(ip);
    expect(dump).not.toContain('UniqueAgentMarker');
    expect(logs.join('\n')).not.toContain(ip);
  });

  it('trusts forwarded visitor headers only with the proxy secret', async () => {
    const { link } = await setup();
    const viaProxy = (secret: string, ip: string) => request(app).get(`/r/${link.code}`)
      .set('X-Forwarded-For', '76.76.21.21') // Vercel egress
      .set('User-Agent', 'node')
      .set('x-mb-proxy-secret', secret)
      .set('x-mb-client-ip', ip)
      .set('x-mb-user-agent', IPHONE);
    await viaProxy('test-proxy-secret', '203.0.113.1'); await recorder.idle();
    await viaProxy('test-proxy-secret', '203.0.113.2'); await recorder.idle();
      await viaProxy('wrong-secret', '203.0.113.3'); await recorder.idle();
    const events = await prisma.clickEvent.findMany({ orderBy: { id: 'asc' } });
    expect(events.slice(0, 2).map(e => [e.device, e.isUnique])).toEqual([['MOBILE', true], ['MOBILE', true]]);
    expect(events[2].device).not.toBe('MOBILE'); // 비밀값이 틀리면 전달 헤더를 무시
  });

  it('a proxy retry after a cold start is not double counted', async () => {
    const { link } = await setup();
    const send = (retry: string) => request(app).get(`/r/${link.code}`)
      .set('x-mb-proxy-secret', 'test-proxy-secret').set('x-mb-client-ip', '203.0.113.9')
      .set('x-mb-user-agent', IPHONE).set('x-mb-retry', retry);
    await send('0'); await recorder.idle();
    await send('1'); await recorder.idle();
    expect(await prisma.clickEvent.count()).toBe(1);
  });

  it('rate limits: over the per-visitor limit still redirects but is not recorded; over the per-IP limit returns 429', async () => {
    const { link } = await setup();
    await setSetting('click.rateLimit', { perVisitorPerLinkPerMin: 2, perIpPerMin: 5 }, SYSTEM_ID);
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) { statuses.push((await click(link.code, '203.0.113.50')).status); await recorder.idle(); }
    expect(statuses.slice(0, 5)).toEqual([302, 302, 302, 302, 302]);
    expect(statuses.slice(5)).toEqual([429, 429]);
    expect(await prisma.clickEvent.count()).toBe(2);
  });
});
