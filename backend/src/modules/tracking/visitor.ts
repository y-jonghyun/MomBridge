import { createHmac } from 'crypto';
import { formatDay } from '../../lib/clock';

export type Device = 'MOBILE' | 'PC' | 'UNKNOWN';

export interface BotRule { name: string; pattern: string }

/** 봇 판정. 빈 UA와 HEAD 요청도 봇으로 본다. 반환값은 걸린 규칙 이름(UA 원문은 저장하지 않음) */
export function detectBot(userAgent: string, method: string, rules: BotRule[]): string | null {
  if (method === 'HEAD') return 'head-request';
  if (!userAgent.trim()) return 'empty-ua';
  for (const rule of rules) {
    try {
      if (new RegExp(rule.pattern, 'i').test(userAgent)) return rule.name;
    } catch { /* 잘못된 규칙은 무시 (저장 시 검증하지만 방어적으로) */ }
  }
  return null;
}

export function detectDevice(userAgent: string): Device {
  if (/Mobi|Android|iPhone|iPod|iPad|Windows Phone|NAVER\(inapp|KAKAOTALK/i.test(userAgent)) return 'MOBILE';
  if (/Windows NT|Macintosh|X11|Linux x86_64|CrOS/i.test(userAgent)) return 'PC';
  return 'UNKNOWN';
}

/** referer는 호스트명만 남긴다 (경로·쿼리에 개인정보가 있을 수 있음) */
export function refererDomain(referer: string | undefined): string | null {
  if (!referer) return null;
  try {
    const host = new URL(referer).hostname.toLowerCase();
    return host ? host.slice(0, 255) : null;
  } catch {
    return null;
  }
}

/**
 * 고유 방문자 해시. 날짜를 입력에 섞어 다른 날의 방문끼리는 연결할 수 없게 한다.
 * IP 원문은 이 함수 밖으로 나가지 않는다.
 */
export function visitorHash(secret: string, dayKey: Date, ip: string, userAgent: string): string {
  return createHmac('sha256', secret).update(`${formatDay(dayKey)}|${ip}|${userAgent}`).digest('hex');
}
