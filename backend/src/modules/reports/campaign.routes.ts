import { Router, Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { clock, parseDay } from '../../lib/clock';
import { AppError } from '../../middleware/errorHandler';
import { parseInput } from '../../middleware/validate';
import { destinationUrlSchema, missionKeywordsSchema } from '../missions/missions.schema';
import { getMissionKeywords, saveMissionKeywords } from '../missions/mission-extras';
import { getSetting } from '../settings/settings';
import { buildCampaignReport, resolveRange } from './report.service';
import { requireCampaignAccess } from './campaign-access';

/** 광고주용 캠페인 API — /client/missions/:id/... */
const router = Router();
router.use(authenticate, requireRole('CLIENT', 'OPERATOR'));

export const hashShareToken = (token: string) => createHash('sha256').update(token).digest('hex');

const destinationSchema = z.object({ destinationUrl: destinationUrlSchema });
const shareSchema = z.object({ expiresInDays: z.number().int().min(1) });

// 확정 키워드 조회
router.get('/missions/:id/keywords', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await requireCampaignAccess(req, req.params.id);
    res.json({ success: true, data: await getMissionKeywords(req.params.id) });
  } catch (e) { next(e); }
});

// 키워드 확정 (메인 1 + 서브)
router.put('/missions/:id/keywords', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await requireCampaignAccess(req, req.params.id);
    await saveMissionKeywords(req.params.id, parseInput(missionKeywordsSchema, req.body));
    res.json({ success: true, data: await getMissionKeywords(req.params.id) });
  } catch (e) { next(e); }
});

// 도착 URL 등록·변경
router.patch('/missions/:id/destination', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await requireCampaignAccess(req, req.params.id);
    const { destinationUrl } = parseInput(destinationSchema, req.body);
    const mission = await prisma.mission.update({
      where: { id: req.params.id },
      data: { destinationUrl },
      select: { id: true, destinationUrl: true, campaignCode: true },
    });
    res.json({ success: true, data: mission });
  } catch (e) { next(e); }
});

// 성과 리포트
router.get('/missions/:id/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mission = await requireCampaignAccess(req, req.params.id);
    const range = resolveRange(parseDay(req.query.from), parseDay(req.query.to), mission.createdAt);
    // 고객사에게는 가린 이름을, 운영자에게는 실명을 내려준다
    const maskNames = req.user!.role === 'CLIENT';
    res.json({ success: true, data: await buildCampaignReport(mission.id, range, { maskNames }) });
  } catch (e) { next(e); }
});

// 공유 링크 발급 — 토큰 원문은 이 응답에서 한 번만 돌려주고 DB에는 해시만 저장
router.post('/missions/:id/report/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mission = await requireCampaignAccess(req, req.params.id);
    const { expiresInDays } = parseInput(shareSchema, req.body);
    if (!env.FRONTEND_URL) throw new AppError('NOT_CONFIGURED', 503, '공유 링크 주소(FRONTEND_URL)가 서버에 설정되지 않았습니다');
    const maxDays = await getSetting('report.shareMaxDays');
    if (expiresInDays > maxDays) throw new AppError('VALIDATION_ERROR', 400, `공유 기간은 최대 ${maxDays}일입니다`);

    const token = randomBytes(32).toString('base64url');
    const share = await prisma.reportShareLink.create({
      data: {
        missionId: mission.id,
        tokenHash: hashShareToken(token),
        createdBy: req.user!.sub,
        expiresAt: new Date(clock.now().getTime() + expiresInDays * 86400000),
      },
    });
    res.status(201).json({
      success: true,
      data: { id: share.id, expiresAt: share.expiresAt, url: `${env.FRONTEND_URL}/reports/shared/${token}` },
    });
  } catch (e) { next(e); }
});

router.get('/missions/:id/report/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mission = await requireCampaignAccess(req, req.params.id);
    const links = await prisma.reportShareLink.findMany({
      where: { missionId: mission.id },
      select: { id: true, expiresAt: true, revokedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: links });
  } catch (e) { next(e); }
});

router.delete('/missions/:id/report/share/:shareId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mission = await requireCampaignAccess(req, req.params.id);
    const { count } = await prisma.reportShareLink.updateMany({
      where: { id: req.params.shareId, missionId: mission.id, revokedAt: null },
      data: { revokedAt: clock.now() },
    });
    if (count === 0) throw new AppError('NOT_FOUND', 404, '공유 링크를 찾을 수 없습니다');
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
