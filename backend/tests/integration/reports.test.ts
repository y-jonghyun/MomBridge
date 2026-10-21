import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant, createTrackingLink } from '../helpers/factory';
import { clock, kstDayKey, addDays } from '../../src/lib/clock';
import { clearSettingsCache } from '../../src/modules/settings/settings';
import { runDailyJob } from '../../src/modules/jobs/daily-job';

describeDb('성과 리포트 · 접근 제어 · 보관 기간', () => {
  beforeEach(async () => {
    await resetDb();
    clearSettingsCache();
    clock.set(null);
  });
  afterAll(async () => {
    clock.set(null);
    await prisma.$disconnect();
  });

  async function setup() {
    const client = await createClient('광고주A');
    const mission = await createMission(client.profile.id, { destinationUrl: 'https://example.com', createdAt: new Date('2026-06-01T00:00:00Z') });
    const p1 = await createParticipant('홍길동');
    const p2 = await createParticipant('김철수');
    const l1 = (await createTrackingLink(mission.id, p1.profile.id)).link;
    const l2 = (await createTrackingLink(mission.id, p2.profile.id)).link;
    return { client, mission, p1, p2, l1, l2 };
  }

  async function addClicks(linkId: string, day: Date, n: { human?: number; unique?: number; bot?: number; mobile?: number }) {
    const rows = [];
    for (let i = 0; i < (n.human ?? 0); i++) {
      rows.push({ linkId, dayKey: day, occurredAt: day, device: i < (n.mobile ?? 0) ? 'MOBILE' as const : 'PC' as const, isBot: false, isUnique: i < (n.unique ?? 0), refererDomain: 'm.blog.naver.com' });
    }
    for (let i = 0; i < (n.bot ?? 0); i++) rows.push({ linkId, dayKey: day, occurredAt: day, device: 'UNKNOWN' as const, isBot: true, isUnique: false, refererDomain: null });
    await prisma.clickEvent.createMany({ data: rows });
    for (let i = 0; i < (n.unique ?? 0); i++) {
      await prisma.clickDailyVisitor.create({ data: { linkId, dayKey: day, visitorHash: `${linkId.slice(0, 8)}${day.getTime()}${i}`.padEnd(64, '0').slice(0, 64) } });
    }
  }

  it('builds the advertiser report: totals, daily series, ranking, devices, notice', async () => {
    const { client, mission, l1, l2 } = await setup();
    clock.set(() => new Date('2026-10-21T03:00:00Z'));
    const today = kstDayKey();
    await addClicks(l1.id, addDays(today, -1), { human: 5, unique: 3, mobile: 4, bot: 2 });
    await addClicks(l2.id, today, { human: 2, unique: 2, mobile: 0 });

    const res = await request(app).get(`/api/v1/client/missions/${mission.id}/report?from=2026-10-19&to=2026-10-21`)
      .set('Authorization', `Bearer ${client.token}`);
    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r.notice).toBe('블로그 글의 추적 링크를 눌러 넘어온 방문만 집계됩니다. 블로그 조회수와는 다릅니다.');
    expect(r.totals).toMatchObject({ clicks: 7, uniqueVisitors: 5 });
    expect(r.devices).toEqual({ mobile: 4, pc: 3, unknown: 0 });
    expect(r.daily).toEqual([
      { day: '2026-10-19', clicks: 0, uniqueVisitors: 0 },
      { day: '2026-10-20', clicks: 5, uniqueVisitors: 3 },
      { day: '2026-10-21', clicks: 2, uniqueVisitors: 2 },
    ]);
    expect(r.ranking.map((x: any) => [x.participantName, x.clicks])).toEqual([['홍길동', 5], ['김철수', 2]]);
    expect(r.disclosure.NOT_SUBMITTED).toBe(2);
  });

  it('필수 10: another advertiser cannot see the report, keywords or share links (404); participants get 403', async () => {
    const { mission, p1 } = await setup();
    const other = await createClient('광고주B');
    for (const path of ['report', 'keywords', 'report/share']) {
      const res = await request(app).get(`/api/v1/client/missions/${mission.id}/${path}`).set('Authorization', `Bearer ${other.token}`);
      expect(res.status).toBe(404);
    }
    const share = await request(app).post(`/api/v1/client/missions/${mission.id}/report/share`)
      .set('Authorization', `Bearer ${other.token}`).send({ expiresInDays: 7 });
    expect(share.status).toBe(404);
    const asParticipant = await request(app).get(`/api/v1/client/missions/${mission.id}/report`).set('Authorization', `Bearer ${p1.token}`);
    expect(asParticipant.status).toBe(403);
    expect((await request(app).get(`/api/v1/client/missions/${mission.id}/report`)).status).toBe(401);
  });

  it('operators can see any campaign report', async () => {
    const { mission } = await setup();
    const op = await createOperator();
    expect((await request(app).get(`/api/v1/client/missions/${mission.id}/report`).set('Authorization', `Bearer ${op.token}`)).status).toBe(200);
  });

  it('share links: masked names, expire, can be revoked, token stored only as a hash', async () => {
    const { client, mission } = await setup();
    const created = await request(app).post(`/api/v1/client/missions/${mission.id}/report/share`)
      .set('Authorization', `Bearer ${client.token}`).send({ expiresInDays: 7 });
    expect(created.status).toBe(201);
    const token = created.body.data.url.split('/reports/shared/')[1];
    expect(JSON.stringify(await prisma.reportShareLink.findMany())).not.toContain(token);

    const shared = await request(app).get(`/api/v1/reports/shared/${token}`);
    expect(shared.status).toBe(200);
    expect(shared.body.data.ranking.map((x: any) => x.participantName).sort()).toEqual(['김*수', '홍*동'].sort());
    expect(shared.body.data.mission.destinationUrl).toBeUndefined();

    clock.set(() => new Date(Date.now() + 8 * 86400000));
    expect((await request(app).get(`/api/v1/reports/shared/${token}`)).status).toBe(410);
    clock.set(null);

    await request(app).delete(`/api/v1/client/missions/${mission.id}/report/share/${created.body.data.id}`)
      .set('Authorization', `Bearer ${client.token}`).expect(200);
    expect((await request(app).get(`/api/v1/reports/shared/${token}`)).status).toBe(410);

    const tooLong = await request(app).post(`/api/v1/client/missions/${mission.id}/report/share`)
      .set('Authorization', `Bearer ${client.token}`).send({ expiresInDays: 31 });
    expect(tooLong.status).toBe(400);
    expect((await request(app).get('/api/v1/reports/shared/not-a-real-token-but-long-enough')).status).toBe(404);
  });

  it('필수 11: the retention job deletes old raw data but keeps daily aggregates, and is idempotent', async () => {
    const { client, mission, l1 } = await setup();
    clock.set(() => new Date('2026-10-21T03:00:00Z'));
    const today = kstDayKey();
    const old = addDays(today, -91);
    const recent = addDays(today, -89);
    await addClicks(l1.id, old, { human: 4, unique: 2, mobile: 1, bot: 1 });
    await addClicks(l1.id, recent, { human: 3, unique: 3 });

    const before = (await request(app).get(`/api/v1/client/missions/${mission.id}/report?from=2026-07-01&to=2026-10-21`)
      .set('Authorization', `Bearer ${client.token}`)).body.data.totals;
    expect(before).toMatchObject({ clicks: 7, uniqueVisitors: 5 });

    const first = await runDailyJob();
    expect(first.deletedClickEvents).toBe(5);
    expect(first.deletedVisitorHashes).toBe(2);
    expect(await prisma.clickEvent.count({ where: { dayKey: old } })).toBe(0);
    expect(await prisma.clickDailyVisitor.count({ where: { dayKey: old } })).toBe(0);
    expect(await prisma.clickEvent.count({ where: { dayKey: recent } })).toBe(3);
    expect(await prisma.clickDaily.findUniqueOrThrow({ where: { linkId_dayKey: { linkId: l1.id, dayKey: old } } }))
      .toMatchObject({ totalClicks: 4, uniqueVisitors: 2, mobileClicks: 1, pcClicks: 3, botClicks: 1 });

    const second = await runDailyJob();
    expect(second.deletedClickEvents).toBe(0);

    const after = (await request(app).get(`/api/v1/client/missions/${mission.id}/report?from=2026-07-01&to=2026-10-21`)
      .set('Authorization', `Bearer ${client.token}`)).body.data.totals;
    expect(after).toEqual(before);
  });

  it('the job endpoint requires the internal token', async () => {
    expect((await request(app).post('/api/v1/internal/jobs/daily')).status).toBe(404);
    expect((await request(app).post('/api/v1/internal/jobs/daily').set('X-Internal-Token', 'nope')).status).toBe(404);
    const ok = await request(app).post('/api/v1/internal/jobs/daily').set('X-Internal-Token', 'test-job-token');
    expect(ok.status).toBe(200);
  });

  it('participants see clicks per review; operators get a summary and CSV', async () => {
    const { mission, p1, l1 } = await setup();
    await addClicks(l1.id, kstDayKey(), { human: 3, unique: 2 });
    const mine = await request(app).get('/api/v1/participant/reviews/stats').set('Authorization', `Bearer ${p1.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toEqual([expect.objectContaining({ missionId: mission.id, clicks: 3, uniqueVisitors: 2 })]);

    const op = await createOperator();
    const summary = await request(app).get('/api/v1/operator/reports/summary').set('Authorization', `Bearer ${op.token}`);
    expect(summary.body.data.total).toMatchObject({ campaigns: 1, clicks: 3, uniqueVisitors: 2 });
    const csv = await request(app).get('/api/v1/operator/reports/export.csv').set('Authorization', `Bearer ${op.token}`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    expect(csv.text).toContain(mission.campaignCode);

    const client = await createClient();
    expect((await request(app).get('/api/v1/operator/reports/summary').set('Authorization', `Bearer ${client.token}`)).status).toBe(403);
  });

  it('operators can edit whitelisted settings only, with validation', async () => {
    const op = await createOperator();
    const auth = { Authorization: `Bearer ${op.token}` };
    expect((await request(app).put('/api/v1/operator/settings/submission.disclosurePhrases').set(auth).send({ value: ['원고료', '('] })).status).toBe(400);
    expect((await request(app).put('/api/v1/operator/settings/submission.disclosurePhrases').set(auth).send({ value: ['원고료'] })).status).toBe(200);
    expect((await request(app).put('/api/v1/operator/settings/click.retentionDays').set(auth).send({ value: 1 })).status).toBe(404);
    const list = await request(app).get('/api/v1/operator/settings').set(auth);
    expect(list.body.data.find((s: any) => s.key === 'submission.disclosurePhrases').value).toEqual(['원고료']);
  });
});
