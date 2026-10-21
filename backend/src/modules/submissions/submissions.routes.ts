import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { parseInput } from '../../middleware/validate';

const router = Router();

const httpUrl = z.string().trim().max(2048).url().refine(v => /^https?:\/\//i.test(v), 'http/https URL만 허용됩니다');

const applySchema = z.object({
  missionId: z.string().uuid(),
  message: z.string().max(2000).optional(),
});

const contentSchema = z.object({
  description: z.string().max(10000).optional(),
  mediaUrls: z.array(httpUrl).max(20).optional(),
  snsPostUrl: z.preprocess(v => (v === '' ? undefined : v), httpUrl.optional()),
});

const submitSchema = contentSchema.extend({ missionId: z.string().uuid() });

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'REVISION']),
  reviewNote: z.string().max(5000).optional(),
  rejectionReason: z.string().max(5000).optional(),
});

async function requireParticipantProfile(userId: string) {
  const profile = await prisma.participantProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError('PROFILE_REQUIRED', 403, '참여자 프로필이 필요합니다');
  return profile;
}

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
    const input = parseInput(applySchema, req.body);
    const profile = await requireParticipantProfile(req.user!.sub);

    const mission = await prisma.mission.findFirst({ where: { id: input.missionId, status: 'OPEN', isVisible: true } });
    if (!mission) throw new AppError('NOT_FOUND', 404, '모집 중인 미션을 찾을 수 없습니다');

    const duplicate = await prisma.application.findUnique({
      where: { missionId_participantId: { missionId: input.missionId, participantId: profile.id } },
    });
    if (duplicate) throw new AppError('ALREADY_APPLIED', 409, '이미 지원한 미션입니다');

    const application = await prisma.application.create({
      data: { missionId: input.missionId, participantId: profile.id, message: input.message },
    });
    res.status(201).json({ success: true, data: application });
  } catch (e) { next(e); }
});

// 인증 콘텐츠 제출
router.post('/', authenticate, requireRole('PARTICIPANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseInput(submitSchema, req.body);
    const profile = await requireParticipantProfile(req.user!.sub);

    const application = await prisma.application.findFirst({
      where: { missionId: input.missionId, participantId: profile.id, status: 'APPROVED' },
    });
    if (!application) throw new AppError('NOT_APPROVED', 403, '승인된 지원서가 없습니다');

    const existing = await prisma.submission.findUnique({ where: { applicationId: application.id } });
    if (existing) {
      throw new AppError('ALREADY_SUBMITTED', 409, '이미 제출했습니다. 수정 요청을 받은 경우 재제출을 이용하세요');
    }

    const submission = await prisma.submission.create({
      data: {
        missionId: input.missionId,
        applicationId: application.id,
        participantId: profile.id,
        description: input.description,
        mediaUrls: input.mediaUrls ?? [],
        snsPostUrl: input.snsPostUrl,
      },
    });
    res.status(201).json({ success: true, data: submission });
  } catch (e) { next(e); }
});

// 수정 요청(REVISION)을 받은 제출물 재제출
router.patch('/:id/resubmit', authenticate, requireRole('PARTICIPANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseInput(contentSchema, req.body);
    const profile = await requireParticipantProfile(req.user!.sub);

    const submission = await prisma.submission.findFirst({ where: { id: req.params.id, participantId: profile.id } });
    if (!submission) throw new AppError('NOT_FOUND', 404, '제출물을 찾을 수 없습니다');
    if (submission.status !== 'REVISION') {
      throw new AppError('NOT_REVISION', 409, '수정 요청을 받은 제출물만 재제출할 수 있습니다');
    }
    if (submission.revisionCount >= submission.maxRevisions) {
      throw new AppError('REVISION_LIMIT', 409, `재제출은 최대 ${submission.maxRevisions}회까지 가능합니다`);
    }

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        ...(input.description !== undefined && { description: input.description }),
        ...(input.mediaUrls !== undefined && { mediaUrls: input.mediaUrls }),
        ...(input.snsPostUrl !== undefined && { snsPostUrl: input.snsPostUrl }),
        status: 'SUBMITTED',
        revisionCount: { increment: 1 },
        submittedAt: new Date(),
        reviewedAt: null,
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// 검수 (OPERATOR)
router.patch('/:id/review', authenticate, requireRole('OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseInput(reviewSchema, req.body);
    const opProfile = await prisma.operatorProfile.findUnique({ where: { userId: req.user!.sub } });

    const current = await prisma.submission.findUnique({ where: { id: req.params.id } });
    if (!current) throw new AppError('NOT_FOUND', 404, '제출물을 찾을 수 없습니다');
    // 이미 처리된 제출물을 다시 승인하면 정산이 중복 생성되므로 검수 대기 상태만 허용
    if (current.status !== 'SUBMITTED') {
      throw new AppError('ALREADY_REVIEWED', 409, '검수 대기 중인 제출물만 처리할 수 있습니다');
    }

    const submission = await prisma.submission.update({
      where: { id: current.id },
      data: {
        status: input.status,
        reviewNote: input.reviewNote,
        rejectionReason: input.rejectionReason,
        reviewerId: opProfile?.id,
        reviewedAt: new Date(),
        ...(input.status === 'APPROVED' && { approvedAt: new Date() }),
      },
    });

    // 승인 시 정산 레코드 생성 + 알림
    const mission = await prisma.mission.findUnique({ where: { id: submission.missionId } });
    if (input.status === 'APPROVED' && mission) {
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
    // 참여자 userId 조회 후 알림 전송
    const participantUser = await prisma.participantProfile.findUnique({
      where: { id: submission.participantId },
      select: { userId: true },
    });
    if (participantUser && mission) {
      const statusMap: Record<string, { title: string; body: string }> = {
        APPROVED: {
          title: '콘텐츠가 승인됐습니다! 💰',
          body: `[${mission.title}] 제출한 콘텐츠가 승인됐습니다. 정산이 곧 처리됩니다.`,
        },
        REJECTED: {
          title: '콘텐츠 반려 안내',
          body: `[${mission.title}] 제출한 콘텐츠가 반려됐습니다. 사유: ${input.rejectionReason ?? '없음'}`,
        },
        REVISION: {
          title: '콘텐츠 수정 요청',
          body: `[${mission.title}] 수정 요청이 있습니다. 메모: ${input.reviewNote ?? '없음'}`,
        },
      };
      const notifData = statusMap[input.status];
      if (notifData) {
        await prisma.notification.create({
          data: {
            userId: participantUser.userId,
            type: 'SUBMISSION_FEEDBACK',
            title: notifData.title,
            body: notifData.body,
            resourceId: submission.id,
            resourceType: 'submission',
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
