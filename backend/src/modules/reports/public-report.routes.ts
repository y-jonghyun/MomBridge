import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../config/database';
import { clock, parseDay } from '../../lib/clock';
import { AppError } from '../../middleware/errorHandler';
import { buildCampaignReport, resolveRange } from './report.service';
import { hashShareToken } from './campaign.routes';

/** 공유 링크로 보는 읽기 전용 리포트 — /reports/shared/:token (로그인 불필요, 체험단원 이름 마스킹) */
const router = Router();

const limiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: false, legacyHeaders: false });

router.get('/shared/:token', limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token;
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new AppError('NOT_FOUND', 404, '공유 링크를 찾을 수 없습니다');
    const share = await prisma.reportShareLink.findUnique({
      where: { tokenHash: hashShareToken(token) },
      include: { mission: { select: { createdAt: true } } },
    });
    if (!share) throw new AppError('NOT_FOUND', 404, '공유 링크를 찾을 수 없습니다');
    if (share.revokedAt || share.expiresAt <= clock.now()) throw new AppError('SHARE_EXPIRED', 410, '만료되었거나 폐기된 공유 링크입니다');

    const range = resolveRange(parseDay(req.query.from), parseDay(req.query.to), share.mission.createdAt);
    const report = await buildCampaignReport(share.missionId, range, { maskNames: true });
    res.set('Cache-Control', 'no-store').set('X-Robots-Tag', 'noindex');
    res.json({ success: true, data: { ...report, mission: { ...report.mission, destinationUrl: undefined }, expiresAt: share.expiresAt } });
  } catch (e) { next(e); }
});

export default router;
