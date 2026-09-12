import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';

const router = Router();
router.use(authenticate, requireRole('OPERATOR'));

// 대시보드 통계
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, totalMissions, pendingApplications, pendingSubmissions, pendingPayouts] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.mission.count(),
      prisma.application.count({ where: { status: 'PENDING' } }),
      prisma.submission.count({ where: { status: 'SUBMITTED' } }),
      prisma.payout.count({ where: { status: 'PENDING' } }),
    ]);
    const missionsByStatus = await prisma.mission.groupBy({ by: ['status'], _count: true });
    res.json({ success: true, data: { totalUsers, totalMissions, pendingApplications, pendingSubmissions, pendingPayouts, missionsByStatus } });
  } catch (e) { next(e); }
});

// 미션 전체 목록
router.get('/missions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(String(req.query.page ?? '1'), 10);
    const limit = parseInt(String(req.query.limit ?? '20'), 10);
    const status = req.query.status as string | undefined;
    const [missions, total] = await Promise.all([
      prisma.mission.findMany({
        where: status ? { status: status as never } : undefined,
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          clientProfile: { select: { businessName: true } },
          _count: { select: { applications: true, submissions: true } },
        },
      }),
      prisma.mission.count({ where: status ? { status: status as never } : undefined }),
    ]);
    res.json({ success: true, data: { missions, total, page, limit } });
  } catch (e) { next(e); }
});

// 미션 상태 변경
router.patch('/missions/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mission = await prisma.mission.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        ...(req.body.status === 'OPEN' && { publishedAt: new Date() }),
        ...(req.body.status === 'CLOSED' && { closedAt: new Date() }),
      },
    });
    res.json({ success: true, data: mission });
  } catch (e) { next(e); }
});

// 지원서 목록
router.get('/applications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const applications = await prisma.application.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        mission: { select: { title: true, rewardAmount: true } },
        participant: { include: { user: { select: { name: true, email: true } } } },
      },
    });
    res.json({ success: true, data: applications });
  } catch (e) { next(e); }
});

// 지원서 승인/반려
router.patch('/applications/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const opProfile = await prisma.operatorProfile.findUnique({ where: { userId: req.user!.sub } });
    const app = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        rejectionReason: req.body.rejectionReason,
        reviewerId: opProfile?.id,
        reviewedAt: new Date(),
      },
      include: {
        mission: { select: { title: true } },
        participant: { select: { userId: true } },
      },
    });
    // 승인 시 미션 currentCount 증가
    if (req.body.status === 'APPROVED') {
      await prisma.mission.update({ where: { id: app.missionId }, data: { currentCount: { increment: 1 } } });
    }
    // 참여자에게 알림 전송
    const isApproved = req.body.status === 'APPROVED';
    await prisma.notification.create({
      data: {
        userId: app.participant.userId,
        type: 'APPLICATION_RESULT',
        title: isApproved ? '지원이 승인됐습니다! 🎉' : '지원 결과 안내',
        body: isApproved
          ? `[${app.mission.title}] 미션 지원이 승인됐습니다. 지금 바로 콘텐츠를 제출해보세요!`
          : `[${app.mission.title}] 미션 지원이 반려됐습니다. 사유: ${req.body.rejectionReason ?? '없음'}`,
        resourceId: app.id,
        resourceType: 'application',
      },
    });
    res.json({ success: true, data: app });
  } catch (e) { next(e); }
});

// 정산 목록
router.get('/payouts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const payouts = await prisma.payout.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        participant: { include: { user: { select: { name: true, email: true } } } },
        submission: { include: { mission: { select: { title: true } } } },
      },
    });
    res.json({ success: true, data: payouts });
  } catch (e) { next(e); }
});

// 정산 처리
router.patch('/payouts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payout = await prisma.payout.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        ...(req.body.status === 'COMPLETED' && { completedAt: new Date() }),
      },
    });
    res.json({ success: true, data: payout });
  } catch (e) { next(e); }
});

// 사용자 목록
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role as string | undefined;
    const users = await prisma.user.findMany({
      where: { ...(role ? { role: role as never } : {}), deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, lastLoginAt: true },
    });
    res.json({ success: true, data: users });
  } catch (e) { next(e); }
});

// 사용자 활성/비활성
router.patch('/users/:id/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: req.body.isActive },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

export default router;
