import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant, createTrackingLink } from '../helpers/factory';
import { clearSettingsCache } from '../../src/modules/settings/settings';
import { NaverBlogPostFetcher, PostFetcher, setPostFetcher } from '../../src/modules/review-check/post-fetcher';
import type { NaverBlogPostRef } from '../../src/modules/review-check/naver-blog-url';

class FakeFetcher implements PostFetcher {
  calls: NaverBlogPostRef[] = [];
  html = '';
  status = 200;
  fail = false;
  async fetchPost(ref: NaverBlogPostRef) {
    this.calls.push(ref);
    if (this.fail) throw new Error('network');
    return { status: this.status, html: this.html };
  }
}

const POST_URL = 'https://m.blog.naver.com/mom_kim/223456789012';

function blogHtml(title: string, firstParagraph: string, code: string) {
  return `<div class="se-component se-documentTitle"><div class="se-title-text">${title}</div></div>
  <div class="se-main-container">
    <div class="se-component se-text"><p>${firstParagraph}</p></div>
    <div class="se-component se-text"><p>망원동 카페 분위기 좋아요</p></div>
    <div class="se-component se-oglink"><a href="https://mombridge.vercel.app/r/${code}">예약</a></div>
  </div>`;
}

describeDb('리뷰 제출 확인 · 대가 표시', () => {
  let fetcher: FakeFetcher;

  beforeEach(async () => {
    await resetDb();
    clearSettingsCache();
    fetcher = new FakeFetcher();
    setPostFetcher(fetcher);
  });
  afterAll(async () => {
    setPostFetcher(new NaverBlogPostFetcher());
    await prisma.$disconnect();
  });

  async function setup() {
    const client = await createClient();
    const mission = await createMission(client.profile.id, { category: 'REVIEW', destinationUrl: 'https://example.com/book' });
    await prisma.missionKeyword.create({ data: { missionId: mission.id, keyword: '망원동카페', role: 'MAIN' } });
    const p = await createParticipant();
    const { link } = await createTrackingLink(mission.id, p.profile.id);
    const op = await createOperator();
    return { mission, p, link, op };
  }

  const submit = (token: string, missionId: string, snsPostUrl?: string) =>
    request(app).post('/api/v1/submissions').set('Authorization', `Bearer ${token}`).send({ missionId, snsPostUrl, description: '후기' });

  it('rejects non-blog URLs for review campaigns without fetching anything', async () => {
    const { mission, p } = await setup();
    for (const url of ['https://www.instagram.com/p/abc', 'https://naver.me/xyz', undefined]) {
      const res = await submit(p.token, mission.id, url);
      expect(res.status).toBe(400);
    }
    expect(fetcher.calls).toHaveLength(0);
  });

  it('auto-passes a post with the disclosure in the title, fetching it exactly once', async () => {
    const { mission, p, link, op } = await setup();
    fetcher.html = blogHtml('[광고] 망원동 카페 후기', '분위기 최고', link.code);
    const res = await submit(p.token, mission.id, POST_URL);
    expect(res.status).toBe(201);
    expect(fetcher.calls).toHaveLength(1);
    expect(fetcher.calls[0]).toMatchObject({ blogId: 'mom_kim', logNo: '223456789012' });
    expect(res.body.data).toMatchObject({ disclosureCheck: 'AUTO_PASSED', snsPostUrl: 'https://blog.naver.com/mom_kim/223456789012' });
    expect(res.body.data.postCheckResult).toMatchObject({ postFound: true, hasTrackingLink: true, hasMainKeyword: true, disclosurePosition: 'TITLE' });

    const approve = await request(app).patch(`/api/v1/submissions/${res.body.data.id}/review`)
      .set('Authorization', `Bearer ${op.token}`).send({ status: 'APPROVED' });
    expect(approve.status).toBe(200);
  });

  it('필수 9: without a detectable disclosure the post goes to manual review and cannot be approved', async () => {
    const { mission, p, link, op } = await setup();
    fetcher.html = blogHtml('망원동 카페 후기', '분위기 최고', link.code); // 대가 표시 없음 (이미지로만 표시했을 수 있음)
    const res = await submit(p.token, mission.id, POST_URL);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('SUBMITTED'); // 자동 거부·수정 요청 안 함
    expect(res.body.data.disclosureCheck).toBe('NEEDS_MANUAL_REVIEW');
    expect(res.body.data.postCheckResult.manualReasons).toEqual(['DISCLOSURE_NOT_FOUND']);

    const approve = await request(app).patch(`/api/v1/submissions/${res.body.data.id}/review`)
      .set('Authorization', `Bearer ${op.token}`).send({ status: 'APPROVED' });
    expect(approve.status).toBe(422);
    expect(approve.body.error.code).toBe('DISCLOSURE_REQUIRED');
    expect(await prisma.payout.count()).toBe(0);
  });

  it('a disclosure only at the end of the post also needs manual review', async () => {
    const { mission, p, link } = await setup();
    fetcher.html = blogHtml('망원동 카페 후기', `${'본문 '.repeat(150)} 이 글은 소정의 원고료를 지원받아 작성했습니다`, link.code);
    const res = await submit(p.token, mission.id, POST_URL);
    expect(res.body.data.disclosureCheck).toBe('NEEDS_MANUAL_REVIEW');
    expect(res.body.data.postCheckResult.manualReasons).toEqual(['DISCLOSURE_NOT_AT_TOP']);
  });

  it('fetch failures go to manual review instead of erroring', async () => {
    const { mission, p } = await setup();
    fetcher.fail = true;
    const res = await submit(p.token, mission.id, POST_URL);
    expect(res.status).toBe(201);
    expect(res.body.data.postCheckResult.manualReasons).toEqual(['FETCH_FAILED']);
  });

  it('manual confirmation records the operator, time and reason, then allows approval', async () => {
    const { mission, p, link, op } = await setup();
    fetcher.html = blogHtml('망원동 카페 후기', '분위기 최고', link.code);
    const sub = (await submit(p.token, mission.id, POST_URL)).body.data;

    const noReason = await request(app).post(`/api/v1/submissions/${sub.id}/disclosure-confirm`)
      .set('Authorization', `Bearer ${op.token}`).send({ reason: '' });
    expect(noReason.status).toBe(400);

    const byParticipant = await request(app).post(`/api/v1/submissions/${sub.id}/disclosure-confirm`)
      .set('Authorization', `Bearer ${p.token}`).send({ reason: '본인 확인' });
    expect(byParticipant.status).toBe(403);

    const confirm = await request(app).post(`/api/v1/submissions/${sub.id}/disclosure-confirm`)
      .set('Authorization', `Bearer ${op.token}`).send({ reason: '본문 첫 이미지에 "제품 제공" 문구 확인' });
    expect(confirm.status).toBe(200);
    const stored = await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } });
    expect(stored).toMatchObject({
      disclosureCheck: 'MANUAL_CONFIRMED',
      disclosureConfirmedById: op.profile.id,
      disclosureConfirmNote: '본문 첫 이미지에 "제품 제공" 문구 확인',
    });
    expect(stored.disclosureConfirmedAt).toBeInstanceOf(Date);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { targetId: sub.id } });
    expect(audit).toMatchObject({ actorId: op.user.id, action: 'SUBMISSION_DISCLOSURE_MANUAL_CONFIRM' });

    const approve = await request(app).patch(`/api/v1/submissions/${sub.id}/review`)
      .set('Authorization', `Bearer ${op.token}`).send({ status: 'APPROVED' });
    expect(approve.status).toBe(200);
  });

  it('a resubmission is checked once more and clears a previous manual confirmation', async () => {
    const { mission, p, link, op } = await setup();
    fetcher.html = blogHtml('망원동 카페 후기', '분위기 최고', link.code);
    const sub = (await submit(p.token, mission.id, POST_URL)).body.data;
    await request(app).patch(`/api/v1/submissions/${sub.id}/review`).set('Authorization', `Bearer ${op.token}`)
      .send({ status: 'REVISION', reviewNote: '제목에 [광고]를 넣어 주세요' }).expect(200);

    fetcher.html = blogHtml('[광고] 망원동 카페 후기', '분위기 최고', link.code);
    const re = await request(app).patch(`/api/v1/submissions/${sub.id}/resubmit`).set('Authorization', `Bearer ${p.token}`).send({});
    expect(re.status).toBe(200);
    expect(re.body.data.disclosureCheck).toBe('AUTO_PASSED');
    expect(fetcher.calls).toHaveLength(2);
  });

  it('the participant guide shows keywords, the tracking link and the disclosure instruction', async () => {
    const { mission, p, link } = await setup();
    const res = await request(app).get(`/api/v1/participant/missions/${mission.id}/guide`).set('Authorization', `Bearer ${p.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      mainKeyword: '망원동카페',
      trackingUrl: `https://tracking.test.example/r/${link.code}`,
      trackingInstruction: '글에 추적 링크 1개를 넣으세요',
    });
    const stranger = await createParticipant('남');
    expect((await request(app).get(`/api/v1/participant/missions/${mission.id}/guide`).set('Authorization', `Bearer ${stranger.token}`)).status).toBe(404);
  });

  it('hides the tracking link (instead of using a hard-coded domain) when TRACKING_BASE_URL is not set', async () => {
    const { mission, p } = await setup();
    const { env } = await import('../../src/config/env');
    const saved = env.TRACKING_BASE_URL;
    env.TRACKING_BASE_URL = '';
    try {
      const res = await request(app).get(`/api/v1/participant/missions/${mission.id}/guide`).set('Authorization', `Bearer ${p.token}`);
      expect(res.body.data).toMatchObject({ trackingUrl: null, trackingUnavailableReason: 'NOT_CONFIGURED' });
    } finally { env.TRACKING_BASE_URL = saved; }
  });

  it('manual confirmation works for an operator account that has no operator profile yet', async () => {
    const { mission, p, link } = await setup();
    fetcher.html = blogHtml('망원동 카페 후기', '분위기 최고', link.code);
    const sub = (await submit(p.token, mission.id, POST_URL)).body.data;
    const { createUser } = await import('../helpers/factory');
    const legacyOp = await createUser('OPERATOR', '예전 운영자');
    const res = await request(app).post(`/api/v1/submissions/${sub.id}/disclosure-confirm`)
      .set('Authorization', `Bearer ${legacyOp.token}`).send({ reason: '직접 확인' });
    expect(res.status).toBe(200);
    expect(await prisma.operatorProfile.findUnique({ where: { userId: legacyOp.user.id } })).not.toBeNull();
  });

  it('approving an application issues a tracking link', async () => {
    const client = await createClient();
    const mission = await createMission(client.profile.id);
    const p = await createParticipant();
    const op = await createOperator();
    const app1 = await prisma.application.create({ data: { missionId: mission.id, participantId: p.profile.id } });
    await request(app).patch(`/api/v1/operator/applications/${app1.id}`).set('Authorization', `Bearer ${op.token}`)
      .send({ status: 'APPROVED' }).expect(200);
    expect(await prisma.trackingLink.findUnique({ where: { applicationId: app1.id } })).not.toBeNull();
  });
});
