import { z } from 'zod';

/**
 * 비밀번호 규칙 — 8자 이상, 영문과 숫자를 함께.
 * 가입·재설정·변경이 모두 이 스키마를 쓴다.
 */
export const PASSWORD_MIN = 8;

const hasLetter = (v: string) => /[A-Za-z]/.test(v);
const hasDigit = (v: string) => /[0-9]/.test(v);

export const passwordSchema = z.string()
  .min(PASSWORD_MIN, `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다`)
  .max(100, '비밀번호는 100자까지 쓸 수 있습니다')
  .refine(hasLetter, '비밀번호에 영문을 넣어 주세요')
  .refine(hasDigit, '비밀번호에 숫자를 넣어 주세요');

/** 화면에 보여 줄 한 줄 안내 (프론트와 같은 문구) */
export const PASSWORD_HINT = '8자 이상, 영문과 숫자를 함께 넣어 주세요';
