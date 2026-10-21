import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createOperator } from '../helpers/factory';
import { diagnoseBlogPost, formatDiagnose } from '../../src/modules/review-check/diagnose';
import { settingDefaults } from '../../src/modules/settings/settings';

const opts = { trackingCode: 'AbCdEf123456', mainKeyword: '망원동카페', disclosurePhrases: settingDefaults['submission.disclosurePhrases'], topChars: 200 };
const okHtml = `<div class="se-component se-documentTitle"><div class="se-title-text">[광고] 망원동 카페</div></div>
  <div class="se-main-container"><div class="se-component se-text"><p>망원동카페 후기</p></div><a href="https://x/r/AbCdEf123456">예약</a></div>`;
const fetcher = (status: number, html: string, finalUrl = 'https://blog.naver.com/PostView.naver?blogId=a&logNo=223456789012') =>
  ({ fetchPost: async () => ({ status, html, finalUrl, requestUrl: finalUrl, contentType: 'text/html', bytes: html.length, elapsedMs: 12 }) });

describe('블로그 글 진단', () => {
  const URL_ = 'https://blog.naver.com/a/223456789012';

  it('reports fetch details, parsing selectors and the same verdict as the real check', async () => {
    const r = await diagnoseBlogPost(URL_, opts, 'local', fetcher(200, okHtml));
    expect(r.fetch).toMatchObject({ status: 200, bytes: okHtml.length });
    expect(r.parsing).toMatchObject({ contentSelector: '.se-main-container', titleSelector: '.se-title-text', title: '[광고] 망원동 카페' });
    expect(r.result).toMatchObject({ disclosureCheck: 'AUTO_PASSED', disclosurePosition: 'TITLE', hasTrackingLink: true, hasMainKeyword: true });
    expect(r.blockSignals).toEqual([]);
    expect(formatDiagnose(r)).toContain('자동 통과');
  });

  it('flags likely blocking (403, captcha page, redirect to login, short body)', async () => {
    expect((await diagnoseBlogPost(URL_, opts, 'server', fetcher(403, 'Forbidden'))).blockSignals).toContain('HTTP 403');
    const captcha = await diagnoseBlogPost(URL_, opts, 'server', fetcher(200, '<html>자동입력 방지를 위해 보안문자를 입력해 주세요</html>'));
    expect(captcha.blockSignals).toEqual(expect.arrayContaining(['캡차(자동입력 방지) 화면']));
    const login = await diagnoseBlogPost(URL_, opts, 'server', fetcher(200, '<html></html>', 'https://nid.naver.com/nidlogin.login'));
    expect(login.blockSignals.join()).toContain('로그인 페이지');
    expect(login.result!.disclosureCheck).toBe('NEEDS_MANUAL_REVIEW');
  });

  it('does not flag a normal post that carries the hidden captcha layer or mentions captcha in the body', async () => {
    // 실제 PostView 페이지에 들어 있는 숨겨진 안부게시판 캡차 레이어와 스크립트
    const page = `<html><body>${okHtml.replace('망원동카페 후기', '망원동카페 후기 · 보안문자 입력 없이 예약')}
      <div id="captcha_layer" class="layerpopup" style="z-index:-1; display:none;"><div class="frame_wrap">
      <iframe id="captchalayeredframe" src="about:blank" title="안부게시판 캡차"></iframe></div></div>
      <script>var captchaUrl = "/CaptchaLayer.naver";</script></body></html>`;
    const r = await diagnoseBlogPost(URL_, opts, 'local', fetcher(200, page));
    expect(r.parsing!.contentSelector).toBe('.se-main-container');
    expect(r.blockSignals).toEqual([]);
    // 본문이 없는 실제 캡차 화면은 숨겨진 요소·스크립트를 빼고도 잡힌다
    const blocked = await diagnoseBlogPost(URL_, opts, 'server', fetcher(200,
      '<html><body><script>var captcha = 1;</script><div><h2>자동입력 방지</h2><p>보안문자를 입력해 주세요</p></div></body></html>'));
    expect(blocked.blockSignals).toContain('캡차(자동입력 방지) 화면');
  });

  it('reports network errors and URL errors without throwing', async () => {
    const err = await diagnoseBlogPost(URL_, opts, 'server', { fetchPost: async () => { throw new TypeError('fetch failed'); } });
    expect(err.fetch!.error).toContain('fetch failed');
    expect(err.result!.manualReasons[0].code).toBe('FETCH_FAILED');
    const bad = await diagnoseBlogPost('https://naver.me/x', opts, 'local', fetcher(200, ''));
    expect(bad.input.urlError).toContain('naver.me');
    expect(bad.fetch).toBeNull();
  });
});

describeDb('운영자 점검 API', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('is operator-only and validates the URL before fetching anything', async () => {
    const client = await createClient();
    const deny = await request(app).post('/api/v1/operator/tools/check-blog-post').set('Authorization', `Bearer ${client.token}`).send({ url: 'https://blog.naver.com/a/223456789012' });
    expect(deny.status).toBe(403);
    const op = await createOperator();
    const res = await request(app).post('/api/v1/operator/tools/check-blog-post').set('Authorization', `Bearer ${op.token}`).send({ url: 'https://example.com/x' });
    expect(res.status).toBe(200);
    expect(res.body.data.input.urlError).toBeTruthy();
    expect(res.body.data.ranOn.where).toBe('server');
  });
});
