import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { parseInput } from '../../middleware/validate';
import { Prisma } from '@prisma/client';
import { parseNaverBlogUrl } from '../review-check/naver-blog-url';
import { checkReviewPost } from '../review-check/review-check.service';
import { ensureTrackingLink } from '../tracking/links';
import { recruitingCutoff } from '../missions/mission-lifecycle';

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
}).superRefine((v, ctx) => {
  // 반려·수정 요청은 체험단원이 무엇을 고쳐야 하는지 알아야 해서 사유를 반드시 받는다
  if (v.status === 'APPROVED') return;
  if (!v.rejectionReason?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['rejectionReason'],
      message: v.status === 'REJECTED' ? '반려 사유를 적어 주세요' : '무엇을 고쳐야 하는지 적어 주세요',
    });
  }
});

const disclosureConfirmSchema = z.object({
  reason: z.string().trim().min(2, '확인 사유를 입력하세요').max(2000),
});

/** 리뷰(블로그) 캠페인: 네이버 블로그 URL 필수 + 게시글 자동 확인 + 대가 표시 확인 전 승인 불가 */
const isReviewCampaign = (mission: { category: string }) => mission.category === 'REVIEW';

/** 리뷰 캠페인이면 블로그 URL을 검증하고 게시글을 1회 확인한 결과를 돌려준다 */
async function reviewCheckFields(
  mission: { id: string; category: string },
  applicationId: string,
  snsPostUrl: string | undefined,
) {
  if (!isReviewCampaign(mission)) return { snsPostUrl };
  if (!snsPostUrl) throw new AppError('VALIDATION_ERROR', 400, '네이버 블로그 글 주소를 입력하세요');
  const ref = parseNaverBlogUrl(snsPostUrl);
  if ('error' in ref) throw new AppError('INVALID_BLOG_URL', 400, ref.error);

  const link = await ensureTrackingLink(applicationId);
  const { disclosureCheck, result } = await checkReviewPost(ref, mission.id, link.code);
  return {
    snsPostUrl: ref.canonicalUrl,
    postCheckedAt: new Date(result.checkedAt),
    postCheckResult: result as unknown as Prisma.InputJsonValue,
    disclosureCheck,
    disclosureConfirmedById: null,
    disclosureConfirmedAt: null,
    disclosureConfirmNote: null,
  };
}

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

    const mission = await prisma.mission.findFirst({
      where: { id: input.missionId, status: 'OPEN', isVisible: true, endDate: { gte: recruitingCutoff() } },
    });
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

    const mission = await prisma.mission.findUniqueOrThrow({ where: { id: input.missionId }, select: { id: true, category: true } });
    const check = await reviewCheckFields(mission, application.id, input.snsPostUrl);

    const submission = await prisma.submission.create({
      data: {
        missionId: input.missionId,
        applicationId: application.id,
        participantId: profile.id,
        description: input.description,
        mediaUrls: input.mediaUrls ?? [],
        ...check,
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

    const mission = await prisma.mission.findUniqueOrThrow({ where: { id: submission.missionId }, select: { id: true, category: true } });
    // 재제출도 게시글 확인은 1회만
    const check = await reviewCheckFields(mission, submission.applicationId, input.snsPostUrl ?? submission.snsPostUrl ?? undefined);

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        ...(input.description !== undefined && { description: input.description }),
        ...(input.mediaUrls !== undefined && { mediaUrls: input.mediaUrls }),
        ...check,
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
    if (input.status === 'APPROVED') {
      const missionForGate = await prisma.mission.findUniqueOrThrow({ where: { id: current.missionId }, select: { category: true } });
      const disclosureOk = current.disclosureCheck === 'AUTO_PASSED' || current.disclosureCheck === 'MANUAL_CONFIRMED';
      if (isReviewCampaign(missionForGate) && !disclosureOk) {
        throw new AppError('DISCLOSURE_REQUIRED', 422,
          '대가 표시(경제적 이해관계 표시)가 확인되지 않아 승인할 수 없습니다. 게시글을 직접 확인한 뒤 수동 확인 처리하거나 수정 요청을 보내세요');
      }
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

// 대가 표시 수동 확인 (OPERATOR) — 자동 확인에서 문구를 찾지 못한 글(이미지 표시 등)을 운영자가 직접 확인
router.post('/:id/disclosure-confirm', authenticate, requireRole('OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = parseInput(disclosureConfirmSchema, req.body);
    // 예전 회원가입으로 만든 운영자는 프로필이 없을 수 있어, 확인자 기록을 위해 만들어 둔다
    const opProfile = await prisma.operatorProfile.upsert({ where: { userId: req.user!.sub }, create: { userId: req.user!.sub }, update: {} });

    const current = await prisma.submission.findUnique({ where: { id: req.params.id } });
    if (!current) throw new AppError('NOT_FOUND', 404, '제출물을 찾을 수 없습니다');
    if (current.disclosureCheck !== 'NEEDS_MANUAL_REVIEW') {
      throw new AppError('NOT_PENDING_MANUAL_REVIEW', 409, '수동 확인이 필요한 제출물이 아닙니다');
    }

    const now = new Date();
    const [updated] = await prisma.$transaction([
      prisma.submission.update({
        where: { id: current.id },
        data: {
          disclosureCheck: 'MANUAL_CONFIRMED',
          disclosureConfirmedById: opProfile.id,
          disclosureConfirmedAt: now,
          disclosureConfirmNote: reason,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: req.user!.sub,
          action: 'SUBMISSION_DISCLOSURE_MANUAL_CONFIRM',
          targetTable: 'submissions',
          targetId: current.id,
          before: { disclosureCheck: current.disclosureCheck },
          after: { disclosureCheck: 'MANUAL_CONFIRMED', reason, confirmedAt: now.toISOString() },
        },
      }),
    ]);
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// 검수 대기 목록 (OPERATOR)
router.get('/pending', authenticate, requireRole('OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { status: 'SUBMITTED' },
      include: {
        mission: { select: { title: true, category: true } },
        participant: { include: { user: { select: { name: true, email: true } } } },
        disclosureConfirmedBy: { include: { user: { select: { name: true } } } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    // 추적 링크 방문 수 — 검수할 때 "후기를 보고 실제로 들어왔는지"를 같이 본다
    const links = await prisma.trackingLink.findMany({
      where: { applicationId: { in: submissions.map(s => s.applicationId) } },
      select: { applicationId: true, daily: { select: { totalClicks: true, uniqueVisitors: true } } },
    });
    const traffic = new Map(links.map(l => [l.applicationId, l.daily.reduce(
      (acc, d) => ({ clicks: acc.clicks + d.totalClicks, uniqueVisitors: acc.uniqueVisitors + d.uniqueVisitors }),
      { clicks: 0, uniqueVisitors: 0 },
    )]));

    res.json({
      success: true,
      data: submissions.map(s => ({
        ...s,
        traffic: traffic.get(s.applicationId) ?? { clicks: 0, uniqueVisitors: 0 },
      })),
    });
  } catch (e) { next(e); }
});

export default router;
