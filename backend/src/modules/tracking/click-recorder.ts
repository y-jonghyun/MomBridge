import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { clock, kstDayKey } from '../../lib/clock';
import { logger } from '../../utils/logger';
import { getSetting } from '../settings/settings';
import { detectBot, detectDevice, refererDomain, visitorHash } from './visitor';

export interface ClickInput {
  linkId: string;
  ip: string;
  userAgent: string;
  referer?: string;
  method: string;
  /** 프론트 프록시가 백엔드 기동 대기 후 재시도한 요청 */
  retry: boolean;
}

export interface ClickRecorder {
  record(input: ClickInput): Promise<void>;
}

/** 방문자×링크 분당 횟수 (메모리). 넘으면 리다이렉트는 하되 기록하지 않는다 */
class MinuteCounter {
  private buckets = new Map<string, { minute: number; count: number }>();

  hit(key: string, now: number): number {
    const minute = Math.floor(now / 60000);
    const b = this.buckets.get(key);
    if (!b || b.minute !== minute) {
      if (this.buckets.size > 50_000) this.buckets.clear();
      this.buckets.set(key, { minute, count: 1 });
      return 1;
    }
    b.count++;
    return b.count;
  }

  clear() { this.buckets.clear(); }
}

export const visitorCounter = new MinuteCounter();

let warnedNoSecret = false;

export class DbClickRecorder implements ClickRecorder {
  async record(input: ClickInput): Promise<void> {
    if (!env.CLICK_HASH_SECRET) {
      if (!warnedNoSecret) { logger.error('CLICK_HASH_SECRET is not set; click recording disabled'); warnedNoSecret = true; }
      logger.debug('click not recorded: CLICK_HASH_SECRET is not set', { linkId: input.linkId });
      return;
    }
    const now = clock.now();
    const dayKey = kstDayKey(now);
    const [botRules, rateLimit] = await Promise.all([getSetting('click.botRules'), getSetting('click.rateLimit')]);
    const base = {
      linkId: input.linkId,
      occurredAt: now,
      dayKey,
      refererDomain: refererDomain(input.referer),
      device: detectDevice(input.userAgent),
    };

    const botRule = detectBot(input.userAgent, input.method, botRules);
    if (botRule) {
      await prisma.clickEvent.create({ data: { ...base, isBot: true, botRule, isUnique: false } });
      return;
    }

    const hash = visitorHash(env.CLICK_HASH_SECRET, dayKey, input.ip, input.userAgent);
    const hits = visitorCounter.hit(`${input.linkId}:${hash}`, now.getTime());
    if (hits > rateLimit.perVisitorPerLinkPerMin) {
      logger.debug('click not recorded: same visitor over the per-minute limit', {
        linkId: input.linkId, hits, limit: rateLimit.perVisitorPerLinkPerMin,
      });
      return;
    }

    const inserted = await prisma.clickDailyVisitor.createMany({
      data: [{ linkId: input.linkId, dayKey, visitorHash: hash }],
      skipDuplicates: true,
    });
    const isUnique = inserted.count === 1;
    // 백엔드 기동 대기 중 첫 요청이 이미 기록됐을 수 있으므로, 재시도 요청은 오늘 처음 온 방문자일 때만 센다
    if (input.retry && !isUnique) {
      logger.debug('click not recorded: retry of a visitor already seen today', { linkId: input.linkId });
      return;
    }

    await prisma.clickEvent.create({ data: { ...base, isBot: false, isUnique } });
  }
}

let recorder: ClickRecorder = new DbClickRecorder();

export function setClickRecorder(next: ClickRecorder): void { recorder = next; }
export function getClickRecorder(): ClickRecorder { return recorder; }
