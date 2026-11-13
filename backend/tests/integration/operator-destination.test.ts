import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createOperator, createParticipant } from '../helpers/factory';
import { TrackedRecorder } from '../helpers/recorder';
import { setClickRecorder, DbClickRecorder, visitorCounter } from '../../src/modules/tracking/click-recorder';
import { clearResolveCache } from '../../src/modules/tracking/redirect.routes';
import { clearSettingsCache } from '../../src/modules/settings/settings';
import { addDays, formatDay, kstDayKey } from '../../src/lib/clock';

/**
 * 운영자가 대신 등록한 가게의 미션에도 도착 주소·키워드를 넣을 수 있다 (출시 초기에는 모든 미션이 대행 등록).
 * 대행 등록 → 모집 시작 → 신청 → 선정 → 추적 링크가 그 주소로 이동 → 클릭 집계 → 운영자 유입 성과까지 처음부터 끝까지.
 */
jest.mock('../../src/utils/sms', () => ({
  sendAlimTalk: jest.fn().mockResolvedValue(undefined),
  sendSMS: jest.fn().mockResolvedValue(undefined),
}));

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const DEST = 'https://smartstore.naver.com/hapjeong-brunch/products/42?ref=mb';
const day = (offset: number) => formatDay(addDays(kstDayKey(), offset));
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const KEYWORDS = { main: { keyword: '합정 브런치' }, subs: [{ keyword: '망원 브런치' }, { keyword: '합정 카페' }] };

describeDb('운영자 대행 미션의 도착 주소·키워드', () => {
  let recorder: TrackedRecorder;
  beforeEach(async () => {
    await resetDb();
    clearResolveCache();
    clearSettingsCache();
    visitorCounter.clear();
    recorder = new TrackedRecorder();
    setClickRecorder(recorder);
  });
  afterEach(() => recorder.idle());
  afterAll(async () => {
    setClickRecorder(new DbClickRecorder());
    await prisma.$disconnect();
  });

  async function shopAndOperator() {
    const op = await createOperator();
    const shop = await request(app).post('/api/v1/operator/clients').set(auth(op.token)).send({
      businessName: '합정 브런치하우스', businessCategory: 'CAFE', regionSi: '서울특별시', regionGu: '마포구',
      regionDong: '합정동', address: '서울시 마포구 합정동 1',
    });
    expect(shop.status).toBe(201);
    return { op, shopId: shop.body.data.id as string };
  }
  const missionBody = (clientProfileId: string, extra: Record<string, unknown> = {}) => ({
    clientProfileId,
    title: '합정 브런치 체험', description: '브런치를 드시고 후기를 남겨 주세요',
    category: 'REVIEW', regionSi: '서울특별시', regionGu: '마포구', regionDong: '합정동',
    rewardAmount: 30000, maxParticipants: 5,
    startDate: day(0), endDate: day(30), submissionDeadline: day(40),
    ...extra,
  });

  it('대행 등록 때 넣은 도착 주소로 추적 링크가 이동하고 클릭이 운영자 유입 성과에 잡힌다', async () => {
    const { op, shopId } = await shopAndOperator();

    // 1) 대행 등록: 도착 주소 + 키워드
    const created = await request(app).post('/api/v1/missions').set(auth(op.token))
      .send(missionBody(shopId, { destinationUrl: DEST, keywords: KEYWORDS }));
    expect(created.status).toBe(201);
    const missionId: string = created.body.data.id;
    expect(created.body.data.destinationUrl).toBe(DEST);

    // 수정 창이 지금 값을 그대로 보여 준다
    const edit = await request(app).get(`/api/v1/missions/${missionId}/edit`).set(auth(op.token));
    expect(edit.body.data.mission.destinationUrl).toBe(DEST);
    expect(edit.body.data.keywords).toEqual({ main: { keyword: '합정 브런치' }, subs: expect.arrayContaining([{ keyword: '망원 브런치' }, { keyword: '합정 카페' }]) });

    // 2) 모집 시작
    expect((await request(app).patch(`/api/v1/operator/missions/${missionId}/status`).set(auth(op.token)).send({ status: 'OPEN' })).status).toBe(200);

    // 3) 참여자 신청 → 운영자 선정
    const p = await createParticipant('김참여');
    const applied = await request(app).post('/api/v1/submissions/apply').set(auth(p.token)).send({ missionId, message: '꼭 가 보고 싶어요' });
    expect(applied.status).toBe(201);
    const approved = await request(app).patch(`/api/v1/operator/applications/${applied.body.data.id}`).set(auth(op.token)).send({ status: 'APPROVED' });
    expect(approved.status).toBe(200);

    // 4) 참여자 작성 가이드에 추적 링크와 메인 키워드가 나온다
    const guide = await request(app).get(`/api/v1/participant/missions/${missionId}/guide`).set(auth(p.token));
    expect(guide.status).toBe(200);
    expect(guide.body.data.trackingUnavailableReason).toBeNull();
    expect(guide.body.data.trackingUrl).toMatch(/^https:\/\/tracking\.test\.example\/r\/[0-9A-Za-z]{12}$/);
    expect(guide.body.data.mainKeyword).toBe('합정 브런치');
    const code = (guide.body.data.trackingUrl as string).split('/r/')[1];

    // 5) 추적 링크 → 도착 주소(UTM 포함)로 302
    const res = await request(app).get(`/r/${code}`).set('X-Forwarded-For', '203.0.113.9').set('User-Agent', CHROME)
      .set('Referer', 'https://m.blog.naver.com/someone/223456789012');
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.location);
    expect(`${loc.origin}${loc.pathname}`).toBe('https://smartstore.naver.com/hapjeong-brunch/products/42');
    expect(loc.searchParams.get('ref')).toBe('mb');
    expect(loc.searchParams.get('utm_campaign')).toBe(created.body.data.campaignCode);
    expect(loc.searchParams.get('utm_content')).toBe(code);

    // 6) 클릭 집계 → 운영자 유입 성과
    await recorder.idle();
    const link = await prisma.trackingLink.findFirstOrThrow({ where: { code } });
    expect(await prisma.clickEvent.count({ where: { linkId: link.id, isBot: false } })).toBe(1);
    const summary = await request(app).get('/api/v1/operator/reports/summary').set(auth(op.token));
    const row = (summary.body.data.campaigns as { missionId: string; clicks: number }[]).find(c => c.missionId === missionId);
    expect(row?.clicks).toBe(1);

    // 이 과정에서 운영자 계정에 프로필이 생기지 않았다
    expect(await prisma.clientProfile.count({ where: { userId: op.user.id } })).toBe(0);
    expect(await prisma.participantProfile.count({ where: { userId: op.user.id } })).toBe(0);
  });

  it('도착 주소 없이 모집하면 추적 링크가 열리지 않는다 (가이드: NO_DESTINATION, /r: 404) — 수정 창에서 넣으면 열린다', async () => {
    const { op, shopId } = await shopAndOperator();
    const created = await request(app).post('/api/v1/missions').set(auth(op.token)).send(missionBody(shopId));
    const missionId: string = created.body.data.id;
    await request(app).patch(`/api/v1/operator/missions/${missionId}/status`).set(auth(op.token)).send({ status: 'OPEN' });
    const p = await createParticipant();
    const applied = await request(app).post('/api/v1/submissions/apply').set(auth(p.token)).send({ missionId, message: '신청합니다' });
    await request(app).patch(`/api/v1/operator/applications/${applied.body.data.id}`).set(auth(op.token)).send({ status: 'APPROVED' });

    const guide = await request(app).get(`/api/v1/participant/missions/${missionId}/guide`).set(auth(p.token));
    expect(guide.body.data.trackingUrl).toBeNull();
    expect(guide.body.data.trackingUnavailableReason).toBe('NO_DESTINATION');
    const link = await prisma.trackingLink.findFirstOrThrow({ where: { missionId } });
    expect((await request(app).get(`/r/${link.code}`).set('User-Agent', CHROME)).status).toBe(404);

    // 수정 창에서 도착 주소를 넣는다 (다른 칸은 불러온 그대로 보낸다)
    const form = (await request(app).get(`/api/v1/missions/${missionId}/edit`).set(auth(op.token))).body.data.mission;
    const saved = await request(app).put(`/api/v1/missions/${missionId}/edit`).set(auth(op.token)).send({ ...form, destinationUrl: DEST });
    expect(saved.status).toBe(200);
    expect(saved.body.data.changed).toEqual(['destinationUrl']);
    clearResolveCache();
    expect((await request(app).get(`/r/${link.code}`).set('X-Forwarded-For', '203.0.113.10').set('User-Agent', CHROME)).status).toBe(302);
  });

  it('수정 창에서 키워드를 바꾸면 같은 함수로 저장되고 기록이 남는다. 다른 칸을 고쳐도 도착 주소는 그대로', async () => {
    const { op, shopId } = await shopAndOperator();
    const created = await request(app).post('/api/v1/missions').set(auth(op.token))
      .send(missionBody(shopId, { destinationUrl: DEST, keywords: KEYWORDS }));
    const missionId: string = created.body.data.id;
    const form = (await request(app).get(`/api/v1/missions/${missionId}/edit`).set(auth(op.token))).body.data.mission;

    const res = await request(app).put(`/api/v1/missions/${missionId}/edit`).set(auth(op.token))
      .send({ ...form, title: '합정 브런치 체험 (주말)', keywords: { main: { keyword: '망원 브런치' }, subs: [] } });
    expect(res.status).toBe(200);
    expect(res.body.data.changed).toEqual(['title']);
    expect(res.body.data.keywordsChanged).toBe(true);
    const kw = await prisma.missionKeyword.findMany({ where: { missionId } });
    expect(kw.map(k => `${k.role}:${k.keyword}`)).toEqual(['MAIN:망원 브런치']);
    expect((await prisma.mission.findUniqueOrThrow({ where: { id: missionId } })).destinationUrl).toBe(DEST);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { targetId: missionId, action: 'MISSION_UPDATE' } });
    expect((log.after as Record<string, unknown>).keywords).toEqual({ main: '망원 브런치', subs: [] });

    // 같은 키워드를 다시 보내면 바뀐 것이 없다
    const again = await request(app).put(`/api/v1/missions/${missionId}/edit`).set(auth(op.token))
      .send({ ...form, title: '합정 브런치 체험 (주말)', keywords: { main: { keyword: '망원 브런치' }, subs: [] } });
    expect(again.body.data).toMatchObject({ changed: [] });
  });

  it('도착 주소는 http(s) 도메인만 — 이상한 형식은 등록·수정 모두 400', async () => {
    const { op, shopId } = await shopAndOperator();
    for (const bad of [
      'javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://example.com/a', 'file:///etc/passwd', '//evil.com',
      'https://user:pw@example.com/', 'https://exa mple.com', 'http://localhost', 'http://127.0.0.1/', 'https://192.168.0.10/',
      'http://[::1]/', 'mailto:shop@example.com', 'smartstore.naver.com/x',
    ]) {
      const res = await request(app).post('/api/v1/missions').set(auth(op.token)).send(missionBody(shopId, { destinationUrl: bad }));
      expect([bad, res.status]).toEqual([bad, 400]);
    }
    expect(await prisma.mission.count()).toBe(0);

    const ok = await request(app).post('/api/v1/missions').set(auth(op.token)).send(missionBody(shopId, { destinationUrl: 'https://booking.naver.com/booking/6/bizes/1' }));
    expect(ok.status).toBe(201);
    const form = (await request(app).get(`/api/v1/missions/${ok.body.data.id}/edit`).set(auth(op.token))).body.data.mission;
    const bad = await request(app).put(`/api/v1/missions/${ok.body.data.id}/edit`).set(auth(op.token)).send({ ...form, destinationUrl: 'javascript:alert(1)' });
    expect(bad.status).toBe(400);
  });
});
