/**
 * 광고주가 등록하는 도착 URL 검증과 UTM 부착.
 * 리다이렉트는 항상 DB에 저장된 도착 URL로만 하며, 요청 파라미터는 이동 대상에 쓰지 않는다.
 */

export const UTM_SOURCE = 'mombridge';
export const UTM_MEDIUM = 'blog';

export type DestinationCheck = { ok: true; url: string } | { ok: false; reason: string };

export function validateDestinationUrl(input: unknown): DestinationCheck {
  if (typeof input !== 'string') return { ok: false, reason: 'URL을 입력하세요' };
  const raw = input.trim();
  if (!raw) return { ok: false, reason: 'URL을 입력하세요' };
  if (raw.length > 2048) return { ok: false, reason: 'URL이 너무 깁니다' };
  // 제어문자·공백이 섞인 URL은 브라우저마다 해석이 달라질 수 있어 거절
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) return { ok: false, reason: 'URL에 공백이나 제어문자가 있습니다' };

  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false, reason: '올바른 URL 형식이 아닙니다' }; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'http 또는 https 주소만 등록할 수 있습니다' };
  if (url.username || url.password) return { ok: false, reason: '아이디·비밀번호가 포함된 URL은 등록할 수 없습니다' };
  if (!url.hostname || !url.hostname.includes('.')) return { ok: false, reason: '도메인이 올바르지 않습니다' };
  return { ok: true, url: url.toString() };
}

/** 기존 쿼리·해시는 보존하고 utm_* 4개는 덮어쓴다 */
export function buildTrackedDestination(destinationUrl: string, campaignCode: string, linkCode: string): string {
  const url = new URL(destinationUrl);
  url.searchParams.set('utm_source', UTM_SOURCE);
  url.searchParams.set('utm_medium', UTM_MEDIUM);
  url.searchParams.set('utm_campaign', campaignCode);
  url.searchParams.set('utm_content', linkCode);
  return url.toString();
}

export function trackingUrlFor(baseUrl: string, code: string): string {
  return `${baseUrl}/r/${code}`;
}
