import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';

const router = Router();
router.use(authenticate, requireRole('PARTICIPANT', 'OPERATOR'));

async function getOrCreateParticipantProfile(userId: string) {
  return prisma.participantProfile.upsert({
    where: { userId },
    create: { userId, regionSi: '', regionGu: '' },
    update: {},
  });
}

// 내 지원 목록
router.get('/applications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateParticipantProfile(req.user!.sub);

    const applications = await prisma.application.findMany({
      where: { participantId: profile.id },
      include: { mission: { select: { title: true, rewardAmount: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: applications });
  } catch (e) { next(e); }
});

// 내 정산 내역
router.get('/payouts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateParticipantProfile(req.user!.sub);

    const payouts = await prisma.payout.findMany({
      where: { participantId: profile.id },
      include: { submission: { include: { mission: { select: { title: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: payouts });
  } catch (e) { next(e); }
});

export default router;
