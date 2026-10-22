import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * 로그인·가입 무차별 대입 방어. 메모리 저장소라 서버가 재시작되면 초기화된다(Render 인스턴스 1개 기준).
 * 제한에 걸려도 계정이 있는지 없는지는 알 수 없게, 이메일 존재 여부와 상관없이 같은 응답을 준다.
 */
const WINDOW_MS = 15 * 60_000;

/** IPv6는 /64 단위로 묶는다 (한 회선이 주소를 바꿔 가며 우회하지 못하게) */
export function clientKey(req: Request): string {
  const ip = req.ip ?? 'unknown';
  if (ip.includes(':') && !ip.startsWith('::ffff:')) return ip.split(':').slice(0, 4).join(':');
  return ip;
}

function emailKey(req: Request): string {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${clientKey(req)}|${email}`;
}

function tooMany(_req: Request, res: Response) {
  res.status(429).json({
    success: false,
    error: { code: 'TOO_MANY_ATTEMPTS', message: '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요' },
  });
}

const common = { standardHeaders: 'draft-7' as const, legacyHeaders: false, validate: false, handler: tooMany };

/** 같은 IP에서 같은 이메일로 15분에 실패 5회 */
export const loginPerEmail = rateLimit({ ...common, windowMs: WINDOW_MS, limit: 5, keyGenerator: emailKey, skipSuccessfulRequests: true });

/** 같은 IP에서 이메일을 바꿔 가며 시도하는 경우: 15분에 실패 30회 */
export const loginPerIp = rateLimit({ ...common, windowMs: WINDOW_MS, limit: 30, keyGenerator: clientKey, skipSuccessfulRequests: true });

/** 가입: 같은 IP에서 1시간에 20회 */
export const registerPerIp = rateLimit({ ...common, windowMs: 60 * 60_000, limit: 20, keyGenerator: clientKey });

/** 비밀번호 재설정 메일 요청: 같은 IP에서 15분에 5회 (메일 폭탄 방지) */
export const resetRequestPerIp = rateLimit({ ...common, windowMs: WINDOW_MS, limit: 5, keyGenerator: clientKey });

/** 재설정 링크로 새 비밀번호 설정: 같은 IP에서 15분에 20회 */
export const resetConfirmPerIp = rateLimit({ ...common, windowMs: WINDOW_MS, limit: 20, keyGenerator: clientKey });
