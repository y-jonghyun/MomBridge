import * as cheerio from 'cheerio';
import { parseNaverBlogUrl } from './naver-blog-url';
import { NaverBlogPostFetcher, PostFetcher } from './post-fetcher';
import { CheckOptions, MANUAL_REASON_LABEL, runPostCheck } from './review-check.service';

/**
 * 실제 블로그 글 1건으로 확인 로직을 점검하는 진단 (저장하지 않음).
 * CLI(로컬)와 운영자 API(배포 서버)에서 같이 쓴다. 어느 쪽이든 글 1건을 1회만 조회한다.
 */
export interface DiagnoseReport {
  ranOn: { where: 'local' | 'server'; host: string | null; node: string; at: string };
  input: { url: string; canonicalUrl: string | null; urlError: string | null };
  fetch: {
    requestUrl: string | null; finalUrl: string | null; status: number | null; contentType: string | null;
    bytes: number | null; truncated: boolean; elapsedMs: number | null; error: string | null;
  } | null;
  /** 네이버가 접근을 막았을 가능성을 보여주는 신호 */
  blockSignals: string[];
  parsing: { contentSelector: string | null; titleSelector: string | null; title: string; bodyTextLength: number; bodyStart: string } | null;
  result: {
    disclosureCheck: string;
    disclosurePosition: string | null;
    matchedPhrase: string | null;
    hasTrackingLink: boolean | null;
    hasMainKeyword: boolean | null;
    topImagePresent: boolean;
    manualReasons: { code: string; label: string }[];
    warnings: string[];
  } | null;
}

const BLOCK_PATTERNS: [RegExp, string][] = [
  [/captcha|자동입력\s*방지|보안문자/i, '캡차(자동입력 방지) 화면'],
  [/비정상적인\s*(접근|요청)|접근이\s*(제한|차단)/, '비정상 접근 차단 문구'],
  [/Access Denied|Forbidden|Request blocked/i, '접근 거부 문구'],
];

/**
 * 화면에 보이는 글자만. 정상 글에도 숨겨진 안부게시판 캡차 레이어(display:none, iframe)와
 * 스크립트 안의 captcha 문자열이 있어서, HTML 전체로 검사하면 모든 글이 차단으로 보인다.
 */
function visibleText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, template, iframe').remove();
  $('[style]').filter((_, el) => /display\s*:\s*none|visibility\s*:\s*hidden/i.test($(el).attr('style') ?? '')).remove();
  return $('body').text().replace(/\s+/g, ' ');
}

function blockSignals(status: number | null, finalUrl: string | null, html: string, found: boolean): string[] {
  const out: string[] = [];
  if (status !== null && [401, 403, 429, 451, 503].includes(status)) out.push(`HTTP ${status}`);
  if (finalUrl && /nid\.naver\.com|login/i.test(finalUrl)) out.push(`로그인 페이지로 이동됨 (${finalUrl})`);
  // 본문을 읽었으면 차단 화면이 아니다. 본문 속 "보안문자" 같은 단어도 신호로 보지 않는다
  if (!found) {
    const text = visibleText(html);
    for (const [re, label] of BLOCK_PATTERNS) if (re.test(text)) out.push(label);
  }
  if (status === 200 && !found && html.length < 3000) out.push(`본문 없이 짧은 응답 (${html.length}자)`);
  return out;
}

export async function diagnoseBlogPost(
  url: string,
  opts: CheckOptions,
  where: 'local' | 'server',
  fetcher: PostFetcher = new NaverBlogPostFetcher(),
): Promise<DiagnoseReport> {
  const ranOn = {
    where,
    host: process.env.RENDER_SERVICE_NAME ?? process.env.HOSTNAME ?? process.env.COMPUTERNAME ?? null,
    node: process.version,
    at: new Date().toISOString(),
  };
  const ref = parseNaverBlogUrl(url);
  if ('error' in ref) {
    return { ranOn, input: { url, canonicalUrl: null, urlError: ref.error }, fetch: null, blockSignals: [], parsing: null, result: null };
  }

  const run = await runPostCheck(ref, opts, fetcher);
  const f = run.fetched;
  const html = f?.html ?? '';
  const a = run.analysis;
  return {
    ranOn,
    input: { url, canonicalUrl: ref.canonicalUrl, urlError: null },
    fetch: {
      requestUrl: f?.requestUrl ?? null,
      finalUrl: f?.finalUrl ?? null,
      status: f?.status ?? null,
      contentType: f?.contentType ?? null,
      bytes: f?.bytes ?? (f ? html.length : null),
      truncated: f?.truncated ?? false,
      elapsedMs: f?.elapsedMs ?? null,
      error: run.fetchError,
    },
    blockSignals: f ? blockSignals(f.status, f.finalUrl ?? null, html, !!a?.found) : [],
    parsing: a?.debug ? { ...a.debug, title: a.title } : null,
    result: {
      disclosureCheck: run.disclosureCheck,
      disclosurePosition: run.result.disclosurePosition,
      matchedPhrase: run.result.matchedPhrase,
      hasTrackingLink: run.result.hasTrackingLink,
      hasMainKeyword: run.result.hasMainKeyword,
      topImagePresent: run.result.topImagePresent,
      manualReasons: run.result.manualReasons.map(code => ({ code, label: MANUAL_REASON_LABEL[code] })),
      warnings: run.result.warnings,
    },
  };
}

/** 사람이 읽기 좋은 출력 */
export function formatDiagnose(r: DiagnoseReport): string {
  const yn = (v: boolean | null) => (v === null ? '-' : v ? '예' : '아니오');
  const lines = [
    `실행 위치: ${r.ranOn.where === 'server' ? '배포 서버' : '로컬'}${r.ranOn.host ? ` (${r.ranOn.host})` : ''} · ${r.ranOn.at}`,
    `입력 URL: ${r.input.url}`,
  ];
  if (r.input.urlError) return [...lines, `URL 오류: ${r.input.urlError}`].join('\n');
  lines.push(`정규화 URL: ${r.input.canonicalUrl}`);
  if (r.fetch) {
    lines.push('', '[조회]',
      `  요청: ${r.fetch.requestUrl ?? '-'}`,
      `  최종 URL: ${r.fetch.finalUrl ?? '-'}`,
      `  HTTP: ${r.fetch.status ?? '-'} · ${r.fetch.contentType ?? '-'} · ${r.fetch.bytes ?? '-'} bytes${r.fetch.truncated ? ' (2MB에서 잘림)' : ''} · ${r.fetch.elapsedMs ?? '-'}ms`);
    if (r.fetch.error) lines.push(`  오류: ${r.fetch.error}`);
  }
  lines.push(`  차단 신호: ${r.blockSignals.length ? r.blockSignals.join(', ') : '없음'}`);
  if (r.parsing) {
    lines.push('', '[파싱]',
      `  본문 선택자: ${r.parsing.contentSelector ?? '못 찾음'}`,
      `  제목 선택자: ${r.parsing.titleSelector ?? '못 찾음'}`,
      `  제목: ${r.parsing.title || '-'}`,
      `  본문 글자 수: ${r.parsing.bodyTextLength}`,
      `  본문 앞부분: ${r.parsing.bodyStart ? r.parsing.bodyStart.slice(0, 200) : '-'}`);
  }
  if (r.result) {
    lines.push('', '[판정]',
      `  대가 표시: ${r.result.disclosureCheck === 'AUTO_PASSED' ? '자동 통과' : '수동 확인 필요'}` +
        ` (위치: ${r.result.disclosurePosition ?? '-'}${r.result.matchedPhrase ? `, 문구: "${r.result.matchedPhrase}"` : ''})`,
      `  추적 링크 포함: ${yn(r.result.hasTrackingLink)} · 메인 키워드 포함: ${yn(r.result.hasMainKeyword)} · 첫 요소 이미지: ${yn(r.result.topImagePresent)}`);
    for (const m of r.result.manualReasons) lines.push(`  수동 확인 이유: ${m.label}`);
    if (r.result.warnings.length) lines.push(`  경고: ${r.result.warnings.join(', ')}`);
  }
  return lines.join('\n');
}
