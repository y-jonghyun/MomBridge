/**
 * 휴대폰 번호 입력 도우미 — 서버는 숫자만 받는다(01012345678).
 * 화면에서는 치는 대로 하이픈을 붙여 보여 준다.
 */

export const phoneDigits = (raw: string) => raw.replace(/\D/g, '').slice(0, 11);

/** 010-1234-5678 — 아직 다 치지 않았으면 친 만큼만 */
export function formatPhone(raw: string): string {
  const d = phoneDigits(raw);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export const isMobilePhone = (raw: string) => /^010\d{8}$/.test(phoneDigits(raw));
