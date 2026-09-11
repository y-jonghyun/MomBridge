import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

const router = Router();

// 내 제출물 목록
router.get('/my', authenticate, requireRole('PARTICIPANT', 'OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.participantProfile.findUnique({ where: { userId: req.user!.sub } });
    if (!profile) { res.json({ success: true, data: [] }); return; }

    const submissions = await prisma.submission.findMany({
      where: { participantId: profile.id },
      include: { mission: { select: { title: true, rewardAmount: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: submissions });
  } catch (e) { next(e); }
});

// 미션에 지원
router.post('/apply', authenticate, requireRole('PARTICIPANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.participantProfile.findUnique({ where: { userId: req.user!.sub } });
    if (!profile) throw new AppError('PROFILE_REQUIRED', 403, '참여자 프로필이 필요합니다');

    const application = await prisma.application.create({
      data: {
        missionId: req.body.missionId,
        participantId: profile.id,
        message: req.body.message,
      },
    });
    res.status(201).json({ success: true, data: application });
  } catch (e) { next(e); }
});

// 인증 콘텐츠 제출
router.post('/', authenticate, requireRole('PARTICIPANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.participantProfile.findUnique({ where: { userId: req.user!.sub } });
    if (!profile) throw new AppError('PROFILE_REQUIRED', 403, '참여자 프로필이 필요합니다');

    const application = await prisma.application.findFirst({
      where: { missionId: req.body.missionId, participantId: profile.id, status: 'APPROVED' },
    });
    if (!application) throw new AppError('NOT_APPROVED', 403, '승인된 지원서가 없습니다');

    const submission = await prisma.submission.create({
      data: {
        missionId: req.body.missionId,
        applicationId: application.id,
        participantId: profile.id,
        description: req.body.description,
        mediaUrls: req.body.mediaUrls ?? [],
        snsPostUrl: req.body.snsPostUrl,
      },
    });
    res.status(201).json({ success: true, data: submission });
  } catch (e) { next(e); }
});

// 검수 (OPERATOR)
router.patch('/:id/review', authenticate, requireRole('OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const opProfile = await prisma.operatorProfile.findUnique({ where: { userId: req.user!.sub } });

    const submission = await prisma.submission.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        reviewNote: req.body.reviewNote,
        rejectionReason: req.body.rejectionReason,
        reviewerId: opProfile?.id,
        reviewedAt: new Date(),
        ...(req.body.status === 'APPROVED' && { approvedAt: new Date() }),
      },
    });

    // 승인 시 정산 레코드 생성
    if (req.body.status === 'APPROVED') {
      const mission = await prisma.mission.findUnique({ where: { id: submission.missionId } });
      if (mission) {
        const fee = Number(mission.rewardAmount) * 0.1;
        await prisma.payout.create({
          data: {
            submissionId: submission.id,
            participantId: submission.participantId,
            amount: mission.rewardAmount,
            platformFee: fee,
            netAmount: Number(mission.rewardAmount) - fee,
          },
        });
      }
    }

    res.json({ success: true, data: submission });
  } catch (e) { next(e); }
});

// 검수 대기 목록 (OPERATOR)
router.get('/pending', authenticate, requireRole('OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { status: 'SUBMITTED' },
      include: {
        mission: { select: { title: true } },
        participant: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { submittedAt: 'asc' },
    });
    res.json({ success: true, data: submissions });
  } catch (e) { next(e); }
});

export default router;
