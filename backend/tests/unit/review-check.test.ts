import { parseNaverBlogUrl } from '../../src/modules/review-check/naver-blog-url';
import { analyzePost } from '../../src/modules/review-check/post-analyzer';
import { settingDefaults } from '../../src/modules/settings/settings';
import { maskName, summaryToCsv } from '../../src/modules/reports/report.service';

describe('네이버 블로그 URL 검증', () => {
  it.each([
    ['https://blog.naver.com/mom_kim/223456789012', 'mom_kim', '223456789012'],
    ['https://m.blog.naver.com/mom_kim/223456789012', 'mom_kim', '223456789012'],
    ['https://blog.naver.com/PostView.naver?blogId=mom_kim&logNo=223456789012', 'mom_kim', '223456789012'],
    ['https://m.blog.naver.com/PostView.nhn?blogId=mom_kim&logNo=223456789012&navType=by', 'mom_kim', '223456789012'],
  ])('accepts %s', (url, blogId, logNo) => {
    expect(parseNaverBlogUrl(url)).toEqual({ blogId, logNo, canonicalUrl: `https://blog.naver.com/${blogId}/${logNo}` });
  });

  it.each([
    'https://naver.me/abc123',
    'https://blog.naver.com/mom_kim',
    'https://cafe.naver.com/x/123456',
    'https://blog.naver.com.evil.com/a/223456789012',
    'https://www.instagram.com/p/abc',
    'javascript:alert(1)',
    'https://blog.naver.com/a/b/223456789012',
  ])('rejects %s', url => {
    expect(parseNaverBlogUrl(url)).toHaveProperty('error');
  });
});

/** 스마트에디터 ONE 구조를 흉내 낸 게시글 HTML */
function post({ title = '망원동 카페 다녀왔어요', paragraphs = [] as string[], firstImage = false, link = '' }) {
  const img = firstImage
    ? '<div class="se-component se-image"><img src="https://postfiles.pstatic.net/a.jpg" alt=""></div>'
    : '';
  const ps = paragraphs.map(p => `<div class="se-component se-text"><p class="se-text-paragraph">${p}</p></div>`).join('');
  const a = link ? `<div class="se-component se-oglink"><a class="se-oglink-info" href="${link}">예약하기</a></div>` : '';
  return `<html><body><div class="se-component se-documentTitle"><div class="se-title-text"><span>${title}</span></div></div>
    <div class="se-main-container">${img}${ps}${a}</div></body></html>`;
}

const opts = (over: Partial<Parameters<typeof analyzePost>[1]> = {}) => ({
  trackingCode: 'AbCdEf123456',
  mainKeyword: '망원동카페',
  disclosurePhrases: settingDefaults['submission.disclosurePhrases'],
  topChars: settingDefaults['submission.disclosureTopChars'],
  ...over,
});

describe('게시글 분석 · 대가 표시 위치', () => {
  it('passes when the disclosure is in the title', () => {
    const r = analyzePost(post({ title: '[광고] 망원동 카페 후기', paragraphs: ['맛있어요'] }), opts());
    expect(r.disclosurePosition).toBe('TITLE');
  });

  it('passes when the disclosure is at the top of the body', () => {
    const r = analyzePost(post({ paragraphs: ['이 글은 업체로부터 제품을 무상으로 제공받아 작성했습니다.', '본문'.repeat(100)] }), opts());
    expect(r.disclosurePosition).toBe('TOP');
    expect(r.matchedPhrase).toContain('제공받');
  });

  it('flags a disclosure that only appears at the end', () => {
    const r = analyzePost(post({ paragraphs: ['본문 '.repeat(200), '소정의 원고료를 지원받아 작성했습니다'] }), opts());
    expect(r.disclosurePosition).toBe('ELSEWHERE');
  });

  it('does not accept vague wording the FTC guideline lists as unclear ("체험단", "선물")', () => {
    const r = analyzePost(post({ title: '체험단 후기', paragraphs: ['사장님께 선물 받았어요. 업체에서 보내주셨어요.'] }), opts());
    expect(r.disclosurePosition).toBe('NONE');
  });

  it('reports a leading image when no text disclosure is found (image-only disclosure)', () => {
    const r = analyzePost(post({ firstImage: true, paragraphs: ['맛있는 망원동카페'] }), opts());
    expect(r.disclosurePosition).toBe('NONE');
    expect(r.topImagePresent).toBe(true);
  });

  it('detects the tracking link and main keyword', () => {
    const html = post({ paragraphs: ['[광고] 협찬을 받아 작성', '망원동 카페 최고'], link: 'https://mombridge.vercel.app/r/AbCdEf123456' });
    const r = analyzePost(html, opts());
    expect(r.hasTrackingLink).toBe(true);
    expect(r.hasMainKeyword).toBe(true);
    expect(analyzePost(html, opts({ trackingCode: 'Zzzzzzzzzzzz' })).hasTrackingLink).toBe(false);
  });

  it('marks the post as not found when the body container is missing (private/deleted page)', () => {
    expect(analyzePost('<html><body><p>비공개 글입니다</p></body></html>', opts()).found).toBe(false);
  });
});

describe('리포트 유틸', () => {
  it('masks names', () => {
    // 규칙은 lib/mask.ts 한 곳에 있다 (tests/unit/mask.test.ts에서 자세히 본다)
    expect(maskName('홍길동')).toBe('홍○동');
    expect(maskName('김철')).toBe('김○');
    expect(maskName('남궁민수')).toBe('남○○수');
    expect(maskName('A')).toBe('A');
  });

  it('writes a BOM-prefixed CSV and neutralises spreadsheet formulas', () => {
    const csv = summaryToCsv({
      notice: '', range: { from: '2026-10-01', to: '2026-10-31' }, total: { campaigns: 1, reviews: 1, clicks: 3, uniqueVisitors: 2, avgClicksPerReview: 3 },
      campaigns: [{
        missionId: 'm', campaignCode: 'abc', missionTitle: '=HYPERLINK("x")', businessName: '가게, 본점', region: '서울 마포구',
        trackingLinks: 1, reviews: 1, approvedReviews: 1, clicks: 3, uniqueVisitors: 2, avgClicksPerReview: 3, mobileRatio: 0.667, disclosureComplianceRate: 1,
      }],
    });
    expect(csv.startsWith('﻿campaign_code,')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"가게, 본점"');
  });
});
