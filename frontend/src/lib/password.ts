/**
 * 비밀번호 규칙 — 8자 이상, 영문과 숫자를 함께.
 * 서버(backend/src/lib/password.ts)와 같은 규칙이다. 바꿀 때 둘 다 바꾼다.
 */
export const PASSWORD_HINT = '8자 이상, 영문과 숫자를 함께 넣어 주세요';

/** 어긋난 곳이 있으면 안내 문구, 없으면 null */
export function passwordError(value: string): string | null {
  if (value.length < 8) return '비밀번호는 8자 이상이어야 합니다';
  if (!/[A-Za-z]/.test(value)) return '비밀번호에 영문을 넣어 주세요';
  if (!/[0-9]/.test(value)) return '비밀번호에 숫자를 넣어 주세요';
  return null;
}
