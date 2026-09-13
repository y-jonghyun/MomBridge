import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate, requireRole('CLIENT', 'OPERATOR'));

async function getOrCreateClientProfile(userId: string, name = '') {
  return prisma.clientProfile.upsert({
    where: { userId },
    create: { userId, businessName: name, category: '', address: '', regionSi: '', regionGu: '' },
    update: {},
  });
}

// 내 프로필 조회
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateClientProfile(req.user!.sub);
    res.json({ success: true, data: profile });
  } catch (e) { next(e); }
});

// 연락처 업데이트
router.patch('/profile/phone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateClientProfile(req.user!.sub);
    const updated = await prisma.clientProfile.update({
      where: { id: profile.id },
      data: { contactPhone: req.body.phone },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// 내 미션 목록
router.get('/missions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateClientProfile(req.user!.sub);

    const missions = await prisma.mission.findMany({
      where: { clientProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true, submissions: true } } },
    });
    res.json({ success: true, data: missions });
  } catch (e) { next(e); }
});

// 미션별 지원 목록
router.get('/missions/:id/applications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateClientProfile(req.user!.sub);

    const mission = await prisma.mission.findFirst({ where: { id: req.params.id, clientProfileId: profile.id } });
    if (!mission) throw new AppError('NOT_FOUND', 404, '미션을 찾을 수 없습니다');

    const applications = await prisma.application.findMany({
      where: { missionId: req.params.id },
      include: { participant: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: applications });
  } catch (e) { next(e); }
});

// 미션별 제출 목록
router.get('/missions/:id/submissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateClientProfile(req.user!.sub);

    const mission = await prisma.mission.findFirst({ where: { id: req.params.id, clientProfileId: profile.id } });
    if (!mission) throw new AppError('NOT_FOUND', 404, '미션을 찾을 수 없습니다');

    const submissions = await prisma.submission.findMany({
      where: { missionId: req.params.id },
      include: { participant: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: submissions });
  } catch (e) { next(e); }
});

export default router;
