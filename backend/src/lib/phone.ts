/**
 * 휴대폰 번호 — 저장은 숫자만, 표시는 하이픈.
 * 가입·중복 확인·마스킹이 모두 같은 규칙을 쓰도록 한곳에 모아 둔다.
 */

/** 010으로 시작하는 11자리 휴대폰 번호만 받는다 */
const MOBILE = /^010\d{8}$/;

/** 하이픈·공백·괄호를 떼고 숫자만 남긴다 */
export const normalizePhone = (raw: string) => raw.replace(/\D/g, '');

export const isMobilePhone = (digits: string) => MOBILE.test(digits);

/** 010-1234-5678 */
export function formatPhone(digits: string): string {
  if (!isMobilePhone(digits)) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/**
 * 가운데 네 자리를 가린다 (010-****-5678).
 * 목록처럼 여러 사람의 번호가 한 번에 보이는 자리에서 쓴다.
 */
export function maskPhone(digits: string | null | undefined): string | null {
  if (!digits) return null;
  if (!isMobilePhone(digits)) return '***';
  return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
}
