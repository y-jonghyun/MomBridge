import { randomBytes } from 'crypto';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * 암호학적 난수로 만든 base62 문자열. 거부 샘플링으로 문자별 편향을 없앤다.
 * 12자 ≈ 71비트 — 추적 링크 코드를 추측으로 찾는 것이 현실적으로 불가능한 수준.
 */
export function randomBase62(length: number): string {
  let out = '';
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < 248) out += BASE62[byte % 62]; // 248 = 62 × 4
      if (out.length === length) break;
    }
  }
  return out;
}

/** utm_campaign용 캠페인 코드: 소문자+숫자 8자 */
export function randomCampaignCode(): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  let out = '';
  while (out.length < 8) {
    for (const byte of randomBytes(16)) {
      if (byte < 252) out += alphabet[byte % 36]; // 252 = 36 × 7
      if (out.length === 8) break;
    }
  }
  return out;
}

export const TRACKING_CODE_LENGTH = 12;
export const TRACKING_CODE_PATTERN = /^[0-9A-Za-z]{12}$/;
