import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { timingSafeEqual } from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { TRACKING_CODE_PATTERN } from '../../lib/random';
import { logger } from '../../utils/logger';
import { getSetting } from '../settings/settings';
import { buildTrackedDestination } from './destination';
import { getClickRecorder } from './click-recorder';
import { verifySelfClickToken } from './self-click';

/**
 * GET /r/:code — 추적 링크.
 * 302 응답을 먼저 보내고 클릭 기록은 그 뒤에 비동기로 한다. 기록이 실패해도 이동은 된다.
 * 이동 대상은 DB에 저장된 도착 URL + UTM뿐이며, 요청의 어떤 값도 이동 대상에 쓰지 않는다.
 */

interface Resolved { linkId: string; participantId: string; location: string }

// DB가 잠깐 불안정해도 최근에 열린 링크는 계속 이동되도록 5분 캐시
const RESOLVE_TTL_MS = 5 * 60 * 1000;
const resolveCache = new Map<string, { value: Resolved | null; at: number }>();

export function clearResolveCache(): void { resolveCache.clear(); }

async function resolve(code: string): Promise<Resolved | null> {
  const hit = resolveCache.get(code);
  const fresh = hit && Date.now() - hit.at < RESOLVE_TTL_MS;
  if (hit && fresh) return hit.value;
  try {
    const link = await prisma.trackingLink.findUnique({
      where: { code },
      select: { id: true, participantId: true, disabledAt: true, mission: { select: { destinationUrl: true, campaignCode: true } } },
    });
    const value = link && !link.disabledAt && link.mission.destinationUrl
      ? { linkId: link.id, participantId: link.participantId, location: buildTrackedDestination(link.mission.destinationUrl, link.mission.campaignCode, code) }
      : null;
    if (resolveCache.size > 10_000) resolveCache.clear();
    resolveCache.set(code, { value, at: Date.now() });
    return value;
  } catch (err) {
    if (hit) return hit.value; // 만료된 캐시라도 이동을 우선
    throw err;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** 프론트 프록시(Vercel)가 비밀값과 함께 넘긴 경우에만 전달 헤더를 믿는다 */
export function clientInfo(req: Request) {
  const secret = req.get('x-mb-proxy-secret');
  if (env.TRACKING_PROXY_SECRET && secret && safeEqual(secret, env.TRACKING_PROXY_SECRET)) {
    return {
      ip: req.get('x-mb-client-ip') ?? req.ip ?? '',
      userAgent: req.get('x-mb-user-agent') ?? '',
      referer: req.get('x-mb-referer') || undefined,
      retry: Number(req.get('x-mb-retry') ?? '0') > 0,
      selfToken: req.get('x-mb-self') || undefined,
    };
  }
  return { ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '', referer: req.get('referer') || undefined, retry: false, selfToken: undefined };
}

function page(res: Response, status: number, title: string, body: string) {
  res.status(status)
    .set('Cache-Control', 'no-store')
    .set('X-Robots-Tag', 'noindex, nofollow')
    .type('html')
    .send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#334155"><h1 style="font-size:1.25rem">${title}</h1><p>${body}</p></body></html>`);
}

const router = Router();

const ipLimiter = rateLimit({
  windowMs: 60_000,
  limit: async () => (await getSetting('click.rateLimit')).perIpPerMin,
  keyGenerator: req => clientInfo(req).ip || 'unknown',
  standardHeaders: false,
  legacyHeaders: false,
  validate: false,
  handler: (_req, res) => page(res, 429, '요청이 너무 많습니다', '잠시 후 다시 시도해 주세요.'),
});

async function handle(req: Request, res: Response) {
  const code = req.params.code;
  if (!TRACKING_CODE_PATTERN.test(code)) { page(res, 404, '링크를 찾을 수 없습니다', '주소를 다시 확인해 주세요.'); return; }

  let resolved: Resolved | null;
  try {
    resolved = await resolve(code);
  } catch {
    logger.error('tracking link lookup failed', { code });
    page(res, 503, '잠시 후 다시 시도해 주세요', '일시적인 오류로 이동하지 못했습니다.');
    return;
  }
  if (!resolved) { page(res, 404, '링크를 찾을 수 없습니다', '만료됐거나 아직 준비되지 않은 링크입니다.'); return; }

  res.set('Cache-Control', 'no-store').set('X-Robots-Tag', 'noindex, nofollow').redirect(302, resolved.location);

  const info = clientInfo(req);
  const { linkId, participantId } = resolved;
  setImmediate(async () => {
    // 체험단원 본인 클릭(서명된 mb_self 쿠키가 링크 주인과 같음)은 집계하지 않는다
    if (verifySelfClickToken(info.selfToken) === participantId) {
      // 설정을 못 읽으면 집계하지 않는 쪽(기본값)으로 둔다. 다만 조용히 넘어가지 않고 남긴다
      let excludeSelf = true;
      try {
        excludeSelf = await getSetting('click.excludeSelf');
      } catch (err) {
        logger.warn('click.excludeSelf lookup failed; defaulting to excluding the click', { code, error: (err as Error).message });
      }
      if (excludeSelf) { logger.debug('click skipped: own link click with click.excludeSelf on', { code }); return; }
    }
    getClickRecorder()
      .record({ linkId, ip: info.ip, userAgent: info.userAgent, referer: info.referer, method: req.method, retry: info.retry })
      // IP·UA는 로그에 남기지 않는다
      .catch(err => logger.warn('click record failed', { code, error: (err as Error).name }));
  });
}

// Express는 GET 라우트로 HEAD도 처리한다 (HEAD는 봇으로 기록)
router.get('/:code', ipLimiter, (req, res) => { void handle(req, res); });

export default router;
