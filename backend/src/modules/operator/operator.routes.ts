import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { z } from 'zod';
import { parseInput } from '../../middleware/validate';
import { missionStatusSchema } from '../missions/missions.schema';
import { ensureTrackingLink } from '../tracking/links';
import { reportIssue } from '../../lib/monitoring';
import { formatPhone, maskPhone, normalizePhone } from '../../lib/phone';
import { maskAccount } from '../../lib/account';
import { AppError } from '../../middleware/errorHandler';
import { randomBytes, randomUUID } from 'crypto';
import { normalizeProvince } from '../../lib/regions';


/**
 * 운영자가 대신 만드는 가게 계정.
 * 가입하지 않은 가게도 미션을 대행 등록할 수 있게, 로그인할 수 없는 고객사 계정을 만든다.
 */
const createClientSchema = z.object({
  businessName: z.string().trim().min(1).max(200),
  businessCategory: z.enum(['FOOD', 'CAFE', 'KIDS', 'BEAUTY', 'LIVING', 'ETC']).optional(),
  regionSi: z.string().trim().max(50).transform((v, ctx) => {
    const name = normalizeProvince(v);
    if (!name) { ctx.addIssue({ code: 'custom', message: '시·도를 선택해 주세요 (예: 충청북도)' }); return z.NEVER; }
    return name;
  }),
  regionGu: z.string().trim().min(1, '시·군·구를 선택해 주세요').max(50),
  regionDong: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
  contactPhone: z.string().trim().max(20).optional(),
});

/** 가게 정보 수정 — 보낸 칸만 바꾼다. 이메일·비밀번호는 이 경로로 바꾸지 않는다 */
const updateClientSchema = createClientSchema.partial();

/** 메일이 가지 않는 내부용 주소. 이 도메인으로는 어떤 메일·알림도 보내지 않는다 */
const MANAGED_EMAIL_DOMAIN = 'managed.mombridge.local';
export const isManagedEmail = (email: string) => email.toLowerCase().endsWith(`@${MANAGED_EMAIL_DOMAIN}`);

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
        mission: { select: { title: true, rewardAmount: true, regionSi: true, regionGu: true } },
        participant: {
          include: {
            user: { select: { name: true, email: true } },
            // 운영자가 승인 여부를 판단할 자료 (#26: 지원 단계 정보는 운영자만 본다)
            snsAccounts: {
              select: { id: true, platform: true, handle: true, url: true, followerCount: true },
              orderBy: { platform: 'asc' },
            },
          },
        },
      },
    });

    // 지난 참여 이력 — 승인된 후기 수와 반려된 수
    const participantIds = [...new Set(applications.map(a => a.participantId))];
    const past = participantIds.length === 0 ? [] : await prisma.submission.groupBy({
      by: ['participantId', 'status'],
      where: { participantId: { in: participantIds } },
      _count: { _all: true },
    });
    const historyOf = (participantId: string) => ({
      approved: past.find(p => p.participantId === participantId && p.status === 'APPROVED')?._count._all ?? 0,
      rejected: past.find(p => p.participantId === participantId && p.status === 'REJECTED')?._count._all ?? 0,
    });

    res.json({
      success: true,
      data: applications.map(a => ({ ...a, history: historyOf(a.participantId) })),
    });
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
        title: isApproved ? '지원이 승인됐습니다' : '지원 결과 안내',
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
        managedByOperator: true,
        // 고객사 줄에서 '가게 정보'를 바로 열 수 있게 가게 id와 이름을 함께 준다
        clientProfile: { select: { id: true, businessName: true } },
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
        user: { select: { id: true, name: true, email: true, phone: true, managedByOperator: true } },
      },
    });
    // 결제 링크를 어디로 보내는지 확인해야 하는 자리라 번호는 전체로 둔다 (운영자 전용 경로)
    res.json({
      success: true,
      data: clients.map(c => ({
        ...c,
        contactPhone: formatPhone(c.user.phone ?? '') || null,
        /** 운영자가 대신 만든 가게인지 (목록에 배지를 단다) */
        managedByOperator: c.user.managedByOperator,
      })),
    });
  } catch (e) { next(e); }
});

/**
 * 가게 대신 등록 — 가입하지 않은 가게의 고객사 계정을 운영자가 만든다.
 *
 * 만들어지는 계정은 **로그인할 수 없다**: 쓸 수 없는 비밀번호와 managedByOperator 표시를 함께 둔다.
 * 이메일도 메일이 가지 않는 내부용 주소라 어떤 메일·알림도 나가지 않는다.
 * 나중에 사장님이 직접 가입하면 이 가게에 계정을 이어 붙이는 '초대'를 따로 만들 자리다.
 */
router.post('/clients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseInput(createClientSchema, req.body);
    const phone = input.contactPhone ? normalizePhone(input.contactPhone) : null;
    if (phone && (await prisma.user.findUnique({ where: { phone } }))) {
      throw new AppError('PHONE_TAKEN', 409, '이미 등록된 연락처입니다. 고객사 목록에서 찾아 주세요');
    }

    const email = `shop-${randomUUID()}@${MANAGED_EMAIL_DOMAIN}`;
    const created = await prisma.clientProfile.create({
      data: {
        businessName: input.businessName,
        businessCategory: input.businessCategory ?? null,
        category: input.businessCategory ?? 'ETC',
        address: input.address ?? '',
        regionSi: input.regionSi,
        regionGu: input.regionGu,
        regionDong: input.regionDong || null,
        user: {
          create: {
            email,
            // 어떤 비밀번호와도 맞지 않는 값. 로그인은 managedByOperator로 한 번 더 막는다
            passwordHash: `managed:${randomBytes(32).toString('hex')}`,
            role: 'CLIENT',
            name: input.businessName,
            phone,
            managedByOperator: true,
          },
        },
      },
      select: {
        id: true, businessName: true, category: true, businessCategory: true,
        address: true, regionSi: true, regionGu: true, regionDong: true,
        user: { select: { id: true, name: true, email: true, phone: true, managedByOperator: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        action: 'OPERATOR_CLIENT_CREATE',
        targetTable: 'client_profiles',
        targetId: created.id,
        after: {
          businessName: created.businessName,
          region: [created.regionSi, created.regionGu, created.regionDong].filter(Boolean).join(' '),
          managedByOperator: true,
        },
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...created,
        contactPhone: formatPhone(created.user.phone ?? '') || null,
        managedByOperator: true,
      },
    });
  } catch (e) { next(e); }
});

/**
 * 가게 정보 수정 — 이름·업종·지역·주소·대표 연락처.
 *
 * 운영자가 만든 가게와 직접 가입한 고객사 모두 고칠 수 있다.
 * 다만 **이메일과 비밀번호는 이 경로로 바꾸지 않는다** — 본인 계정의 로그인 수단이라서다.
 * 이미 등록된 미션의 지역은 미션마다 따로 저장돼 있어 함께 바꾸지 않는다(가게 이름은 참조라 바로 반영된다).
 */
router.patch('/clients/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseInput(updateClientSchema, req.body);
    const before = await prisma.clientProfile.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, businessName: true, businessCategory: true, address: true,
        regionSi: true, regionGu: true, regionDong: true,
        user: { select: { id: true, phone: true } },
      },
    });
    if (!before) throw new AppError('NOT_FOUND', 404, '가게를 찾을 수 없습니다');

    const phone = input.contactPhone === undefined
      ? undefined
      : (input.contactPhone ? normalizePhone(input.contactPhone) : null);
    if (phone) {
      const taken = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (taken && taken.id !== before.user.id) {
        throw new AppError('PHONE_TAKEN', 409, '이미 등록된 연락처입니다. 다른 번호를 적어 주세요');
      }
    }

    const updated = await prisma.clientProfile.update({
      where: { id: before.id },
      data: {
        ...(input.businessName !== undefined && { businessName: input.businessName }),
        ...(input.businessCategory !== undefined && {
          businessCategory: input.businessCategory,
          category: input.businessCategory,
        }),
        ...(input.regionSi !== undefined && { regionSi: input.regionSi }),
        ...(input.regionGu !== undefined && { regionGu: input.regionGu }),
        ...(input.regionDong !== undefined && { regionDong: input.regionDong || null }),
        ...(input.address !== undefined && { address: input.address ?? '' }),
        ...(phone !== undefined && { user: { update: { phone } } }),
      },
      select: {
        id: true, businessName: true, category: true, businessCategory: true,
        address: true, regionSi: true, regionGu: true, regionDong: true,
        user: { select: { id: true, name: true, email: true, phone: true, managedByOperator: true } },
      },
    });

    // 무엇이 바뀌었는지만 남긴다
    const changedBefore: Record<string, unknown> = {};
    const changedAfter: Record<string, unknown> = {};
    const fields = ['businessName', 'businessCategory', 'address', 'regionSi', 'regionGu', 'regionDong'] as const;
    for (const field of fields) {
      if (before[field] !== updated[field]) {
        changedBefore[field] = before[field];
        changedAfter[field] = updated[field];
      }
    }
    if (phone !== undefined && before.user.phone !== updated.user.phone) {
      // 번호 자체는 기록에 남기지 않는다 (바뀌었다는 사실만)
      changedBefore.contactPhone = before.user.phone ? '있음' : '없음';
      changedAfter.contactPhone = updated.user.phone ? '있음' : '없음';
    }

    if (Object.keys(changedAfter).length > 0) {
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.sub,
          action: 'OPERATOR_CLIENT_UPDATE',
          targetTable: 'client_profiles',
          targetId: before.id,
          before: changedBefore as object,
          after: changedAfter as object,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
        },
      });
    }

    res.json({
      success: true,
      data: {
        ...updated,
        contactPhone: formatPhone(updated.user.phone ?? '') || null,
        managedByOperator: updated.user.managedByOperator,
        changed: Object.keys(changedAfter),
      },
    });
  } catch (e) { next(e); }
});

export default router;
