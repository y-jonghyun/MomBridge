import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import { clock } from '../../lib/clock';

/**
 * 체험단원 본인 클릭 표시. 로그인한 체험단원 브라우저에 서명된 값을 쿠키(mb_self, 경로 /r)로 넣어 두고,
 * 추적 링크 요청에 그 값이 있고 링크 주인과 같으면 클릭을 집계하지 않는다(이동은 그대로).
 * 서명 키는 CLICK_HASH_SECRET. 없으면 기능이 꺼진다.
 */
export const SELF_CLICK_MAX_AGE_SEC = 180 * 86400;

const sign = (participantId: string, exp: number) =>
  createHmac('sha256', env.CLICK_HASH_SECRET).update(`self-click|${participantId}|${exp}`).digest('base64url');

export function selfClickToken(participantId: string): string | null {
  if (!env.CLICK_HASH_SECRET) return null;
  const exp = Math.floor(clock.now().getTime() / 1000) + SELF_CLICK_MAX_AGE_SEC;
  return `${participantId}.${exp}.${sign(participantId, exp)}`;
}

/** 서명이 맞고 만료되지 않았으면 체험단원 프로필 id */
export function verifySelfClickToken(token: string | undefined): string | null {
  if (!token || !env.CLICK_HASH_SECRET) return null;
  const [participantId, expRaw, sig] = token.split('.');
  const exp = Number(expRaw);
  if (!participantId || !sig || !Number.isInteger(exp) || exp * 1000 < clock.now().getTime()) return null;
  const expected = Buffer.from(sign(participantId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? participantId : null;
}
