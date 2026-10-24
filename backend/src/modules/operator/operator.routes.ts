import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { z } from 'zod';
import { parseInput } from '../../middleware/validate';
import { missionStatusSchema } from '../missions/missions.schema';
import { ensureTrackingLink } from '../tracking/links';
import { reportIssue } from '../../lib/monitoring';
import { formatPhone, maskPhone } from '../../lib/phone';
import { maskAccount } from '../../lib/account';
import { AppError } from '../../middleware/errorHandler';

const applicationReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().max(2000).optional(),
});

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
    const { status } = parseInput(missionStatusSchema, req.body);
    const mission = await prisma.mission.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'OPEN' && { publishedAt: new Date() }),
        ...(status === 'CLOSED' && { closedAt: new Date() }),
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
    const { status, rejectionReason } = parseInput(applicationReviewSchema, req.body);
    const opProfile = await prisma.operatorProfile.findUnique({ where: { userId: req.user!.sub } });
    const app = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        status,
        rejectionReason,
        reviewerId: opProfile?.id,
        reviewedAt: new Date(),
      },
      include: {
        mission: { select: { title: true } },
        participant: { select: { userId: true } },
      },
    });
    // 승인 시 미션 currentCount 증가
    if (status === 'APPROVED') {
      await prisma.mission.update({ where: { id: app.missionId }, data: { currentCount: { increment: 1 } } });
      // 체험단원 × 캠페인 추적 링크 발급 (이미 있으면 그대로)
      await ensureTrackingLink(app.id);
    }
    // 참여자에게 알림 전송
    const isApproved = status === 'APPROVED';
    await prisma.notification.create({
      data: {
        userId: app.participant.userId,
        type: 'APPLICATION_RESULT',
        title: isApproved ? '지원이 승인됐습니다! 🎉' : '지원 결과 안내',
        body: isApproved
          ? `[${app.mission.title}] 미션 지원이 승인됐습니다. 지금 바로 콘텐츠를 제출해보세요!`
          : `[${app.mission.title}] 미션 지원이 반려됐습니다. 사유: ${rejectionReason ?? '없음'}`,
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
    // 계좌번호는 끝 네 자리만 내려보낸다. 전체는 '보기'를 눌러 따로 받아 가고, 그때 기록을 남긴다
    res.json({
      success: true,
      data: payouts.map(p => ({
        ...p,
        bankAccount: maskAccount(p.bankAccount),
        hasAccount: !!(p.bankName && p.bankAccount && p.accountHolder),
      })),
    });
  } catch (e) { next(e); }
});

/**
 * 계좌번호 전체 보기. 누가 언제 어느 정산 건의 계좌를 봤는지 AuditLog에 남긴다.
 * 돈과 직접 이어지는 정보라 목록에 함께 담지 않고 이 경로로만 내보낸다.
 */
router.get('/payouts/:id/account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payout = await prisma.payout.findUnique({
      where: { id: req.params.id },
      select: { id: true, bankName: true, bankAccount: true, accountHolder: true },
    });
    if (!payout) throw new AppError('NOT_FOUND', 404, '정산 건을 찾을 수 없습니다');
    if (!payout.bankAccount) throw new AppError('NO_ACCOUNT', 400, '등록된 계좌가 없습니다');

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        action: 'PAYOUT_ACCOUNT_VIEW',
        targetTable: 'payouts',
        targetId: payout.id,
        // 계좌번호 자체는 기록에 남기지 않는다 (기록을 보는 것만으로 번호를 알 수 없게)
        after: { bankName: payout.bankName },
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
      },
    });

    res.json({ success: true, data: payout });
  } catch (e) { next(e); }
});

// 정산 처리
router.patch('/payouts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 계좌가 없으면 지급 완료로 넘기지 못하게 막는다 (돈이 어디로 갔는지 남지 않기 때문)
    if (req.body.status === 'COMPLETED') {
      const current = await prisma.payout.findUnique({
        where: { id: req.params.id },
        select: { bankName: true, bankAccount: true, accountHolder: true },
      });
      if (!current) throw new AppError('NOT_FOUND', 404, '정산 건을 찾을 수 없습니다');
      if (!current.bankName || !current.bankAccount || !current.accountHolder) {
        throw new AppError('NO_ACCOUNT', 400, '계좌가 등록되지 않아 지급 완료로 바꿀 수 없습니다');
      }
    }

    const payout = await prisma.payout.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        ...(req.body.status === 'COMPLETED' && { completedAt: new Date() }),
      },
    });
    if (payout.status === 'FAILED') {
      reportIssue('Payout marked FAILED', { area: 'payout', level: 'error', extra: { payoutId: payout.id, amount: Number(payout.netAmount) } });
    }
    res.json({ success: true, data: payout });
  } catch (e) { next(e); }
});

// 사용자 목록. 여러 사람의 번호가 한 화면에 보이므로 가운데 네 자리를 가린다
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role as string | undefined;
    const users = await prisma.user.findMany({
      where: { ...(role ? { role: role as never } : {}), deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, email: true, name: true, role: true, isActive: true, createdAt: true, lastLoginAt: true, phone: true,
      },
    });
    res.json({ success: true, data: users.map(u => ({ ...u, phone: maskPhone(u.phone) })) });
  } catch (e) { next(e); }
});

// 사용자 한 명 — 번호를 전체로 보여주는 유일한 목록 밖 경로
router.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: {
        id: true, email: true, name: true, role: true, isActive: true, createdAt: true, lastLoginAt: true,
        phone: true, phoneVerifiedAt: true,
      },
    });
    if (!user) throw new AppError('NOT_FOUND', 404, '사용자를 찾을 수 없습니다');
    res.json({ success: true, data: { ...user, phone: formatPhone(user.phone ?? '') || null } });
  } catch (e) { next(e); }
});

// 사용자 활성/비활성
router.patch('/users/:id/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      // 비활성화하면 리프레시 토큰을 무효화해 남은 세션이 재발급받지 못하게 한다
      data: { isActive: req.body.isActive === true, ...(req.body.isActive !== true && { tokenVersion: { increment: 1 } }) },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

// 고객사 프로필 목록 (미션 대행 등록용)
router.get('/clients', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const clients = await prisma.clientProfile.findMany({
      orderBy: { businessName: 'asc' },
      select: {
        id: true, businessName: true, category: true, businessCategory: true,
        // 대행 등록 화면이 고객사를 고르면 주소·지역을 자동으로 채운다
        address: true, regionSi: true, regionGu: true, regionDong: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    // 결제 링크를 어디로 보내는지 확인해야 하는 자리라 번호는 전체로 둔다 (운영자 전용 경로)
    res.json({
      success: true,
      data: clients.map(c => ({ ...c, contactPhone: formatPhone(c.user.phone ?? '') || null })),
    });
  } catch (e) { next(e); }
});

export default router;
