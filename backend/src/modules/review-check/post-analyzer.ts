import * as cheerio from 'cheerio';

/**
 * 블로그 게시글 HTML 분석.
 * 공정위 「추천·보증 등에 관한 표시·광고 심사지침」(2024.12.1 시행): 블로그 등 문자 매체는
 * 경제적 이해관계 표시문구를 "게시물의 제목 또는 첫 부분"에 게재해야 한다.
 * 문구를 텍스트로 찾지 못하면(이미지로만 표시한 경우 포함) 자동 거부하지 않고 수동 확인으로 보낸다.
 */

export type DisclosurePosition = 'TITLE' | 'TOP' | 'ELSEWHERE' | 'NONE';

export interface PostAnalysis {
  found: boolean;
  title: string;
  hasTrackingLink: boolean;
  hasMainKeyword: boolean | null;
  disclosurePosition: DisclosurePosition;
  matchedPhrase: string | null;
  /** 본문 시작 부분에 이미지가 있음 → 이미지로 대가 표시했을 가능성 */
  topImagePresent: boolean;
  /** 진단용: 어떤 선택자로 본문·제목을 찾았는지, 본문 앞부분 */
  debug?: { contentSelector: string | null; titleSelector: string | null; bodyTextLength: number; bodyStart: string };
}

export interface AnalyzeOptions {
  trackingCode: string | null;
  mainKeyword: string | null;
  disclosurePhrases: string[];
  topChars: number;
}

const CONTENT_SELECTORS = ['.se-main-container', '#postViewArea', '.post_ct', '#post-view', '.se_component_wrap'];
const TITLE_SELECTORS = ['.se-title-text', '.se_title .se_textarea', '.pcol1', '.htitle', 'h3.se_textarea'];

const squash = (s: string) => s.replace(/\s+/g, '');

function findPhrase(text: string, patterns: string[]): string | null {
  for (const p of patterns) {
    try {
      const m = new RegExp(p, 'i').exec(text);
      if (m) return m[0].slice(0, 100);
    } catch { /* 저장 시 검증됨 */ }
  }
  return null;
}

export function analyzePost(html: string, opts: AnalyzeOptions): PostAnalysis {
  const $ = cheerio.load(html);
  const contentSelector = CONTENT_SELECTORS.find(s => $(s).first().length > 0) ?? null;
  const content = contentSelector ? $(contentSelector).first() : null;

  let title = '';
  let titleSelector: string | null = null;
  for (const s of TITLE_SELECTORS) {
    const t = $(s).first().text().replace(/\s+/g, ' ').trim();
    if (t) { title = t; titleSelector = s; break; }
  }

  if (!content) {
    return {
      found: false, title, hasTrackingLink: false, hasMainKeyword: null, disclosurePosition: 'NONE', matchedPhrase: null, topImagePresent: false,
      debug: { contentSelector, titleSelector, bodyTextLength: 0, bodyStart: '' },
    };
  }

  // 추적 링크: 일반 링크·링크 카드(OG 링크)·본문 텍스트 어디든 코드가 있으면 포함으로 본다
  const code = opts.trackingCode;
  const hrefs = content.find('a[href]').map((_, a) => $(a).attr('href') ?? '').get().join(' ');
  let decodedHrefs = hrefs;
  try { decodedHrefs = decodeURIComponent(hrefs); } catch { /* 그대로 사용 */ }
  const contentHtml = content.html() ?? '';
  const hasTrackingLink = !!code && (decodedHrefs.includes(`/r/${code}`) || contentHtml.includes(`/r/${code}`));

  content.find('script, style').remove();
  const bodyText = content.text().replace(/\s+/g, ' ').trim();

  const hasMainKeyword = opts.mainKeyword
    ? squash(`${title} ${bodyText}`).toLowerCase().includes(squash(opts.mainKeyword).toLowerCase())
    : null;

  let disclosurePosition: DisclosurePosition = 'NONE';
  let matchedPhrase = findPhrase(title, opts.disclosurePhrases);
  if (matchedPhrase) {
    disclosurePosition = 'TITLE';
  } else {
    const top = bodyText.slice(0, opts.topChars);
    matchedPhrase = findPhrase(top, opts.disclosurePhrases);
    if (matchedPhrase) disclosurePosition = 'TOP';
    else {
      matchedPhrase = findPhrase(bodyText, opts.disclosurePhrases);
      if (matchedPhrase) disclosurePosition = 'ELSEWHERE';
    }
  }

  // 첫 번째 본문 구성요소가 이미지인지 (스마트에디터 ONE: .se-component.se-image)
  const firstComponent = content.find('.se-component:not(.se-documentTitle)').first();
  const topImagePresent = firstComponent.length
    ? firstComponent.is('.se-image, .se-imageStrip, .se-imageGroup, .se-sticker')
    : content.children().first().find('img').addBack('img').length > 0;

  return {
    found: true, title, hasTrackingLink, hasMainKeyword, disclosurePosition, matchedPhrase, topImagePresent,
    debug: { contentSelector, titleSelector, bodyTextLength: bodyText.length, bodyStart: bodyText.slice(0, opts.topChars) },
  };
}
