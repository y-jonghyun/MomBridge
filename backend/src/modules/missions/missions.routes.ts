import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { sendAlimTalk } from '../../utils/sms';

const router = Router();

// 미션 목록 조회 (공개)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(String(req.query.page ?? '1'), 10);
    const limit = parseInt(String(req.query.limit ?? '20'), 10);
    const skip = (page - 1) * limit;

    const sort = String(req.query.sort ?? 'NEWEST');
    const keyword = req.query.keyword as string | undefined;

    const where: any = {
      status: 'OPEN' as const,
      isVisible: true,
      ...(req.query.category && { category: req.query.category as never }),
      ...(req.query.regionSi && { regionSi: String(req.query.regionSi) }),
      ...(req.query.regionGu && { regionGu: String(req.query.regionGu) }),
      ...(keyword && { OR: [{ title: { contains: keyword } }, { description: { contains: keyword } }] }),
    };

    const orderBy: any =
      sort === 'DEADLINE' ? [{ endDate: 'asc' }] :
      sort === 'REWARD'   ? [{ rewardAmount: 'desc' }] :
      sort === 'POPULAR'  ? [{ currentCount: 'desc' }] :
                            [{ createdAt: 'desc' }];

    const [missions, total] = await Promise.all([
      prisma.mission.findMany({
        where, skip, take: limit, orderBy,
        include: { clientProfile: { select: { businessName: true, category: true } }, tags: { include: { tag: true } } },
      }),
      prisma.mission.count({ where }),
    ]);

    res.json({ success: true, data: { missions, total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
});

// 미션 상세 조회
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mission = await prisma.mission.findUnique({
      where: { id: req.params.id },
      include: {
        clientProfile: { select: { businessName: true, category: true, address: true, regionSi: true, regionGu: true } },
        tags: { include: { tag: true } },
        _count: { select: { applications: true } },
      },
    });
    if (!mission) throw new AppError('NOT_FOUND', 404, '미션을 찾을 수 없습니다');
    await prisma.mission.update({ where: { id: req.params.id }, data: { viewCount: { increment: 1 } } });
    res.json({ success: true, data: mission });
  } catch (e) { next(e); }
});

// 미션 생성 — OPERATOR만 허용 (결제 면제 or 고객사 결제 링크 발송)
router.post('/', authenticate, requireRole('OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    let clientProfileId: string = req.body.clientProfileId;
    if (!clientProfileId) {
      const ownProfile = await prisma.clientProfile.findUnique({ where: { userId: user.sub } });
      if (!ownProfile) throw new AppError('PROFILE_REQUIRED', 403, 'clientProfileId가 필요합니다');
      clientProfileId = ownProfile.id;
    }

    const sendPaymentLink: boolean = !!req.body.sendPaymentLink;
    const { clientProfileId: _a, sendPaymentLink: _b, paymentKey: _c, orderId: _d, totalAmount: _e, ...missionData } = req.body;

    const mission = await prisma.mission.create({
      data: {
        ...missionData,
        clientProfileId,
        status: 'DRAFT',
        paymentStatus: sendPaymentLink ? 'PENDING' : 'WAIVED',
      },
    });

    // 결제 링크 SMS/알림톡 발송
    if (sendPaymentLink) {
      const clientProfile = await prisma.clientProfile.findUnique({
        where: { id: clientProfileId },
        select: { contactPhone: true, businessName: true },
      });
      if (clientProfile?.contactPhone) {
        const frontendUrl = process.env.FRONTEND_URL ?? 'https://mombridge.vercel.app';
        const paymentUrl = `${frontendUrl}/client`;
        const fallbackText = `[맘브릿지] ${mission.title} 미션이 등록됐습니다.\n결제 후 미션이 활성화됩니다.\n\n결제 링크: ${paymentUrl}\n(맘브릿지 로그인 후 내 미션 목록에서 확인하세요)`;
        await sendAlimTalk(
          clientProfile.contactPhone,
          process.env.SOLAPI_KAKAO_TEMPLATE_ID ?? '',
          { missionTitle: mission.title, paymentUrl },
          fallbackText,
        ).catch(console.error);
      }
    }

    res.status(201).json({ success: true, data: mission });
  } catch (e) { next(e); }
});

// 결제 후 미션 생성 — CLIENT 전용 (토스페이먼츠 결제 확인)
router.post('/pay-and-create', authenticate, requireRole('CLIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentKey, orderId, amount, ...missionData } = req.body;

    // 1. 토스페이먼츠 결제 확인
    const tossSecretKey = process.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) throw new AppError('CONFIG_ERROR', 500, '결제 설정 오류');

    const authHeader = 'Basic ' + Buffer.from(tossSecretKey + ':').toString('base64');
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!tossRes.ok) {
      const err = await tossRes.json().catch(() => ({}));
      throw new AppError('PAYMENT_FAILED', 400, (err as any).message ?? '결제 확인에 실패했습니다');
    }

    const payment = await tossRes.json() as { paymentKey: string; orderId: string; approvedAt: string };

    // 2. 고객사 프로필 조회
    const clientProfile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.sub } });
    if (!clientProfile) throw new AppError('PROFILE_REQUIRED', 403, '고객사 프로필이 필요합니다');

    // 3. 미션 생성
    const mission = await prisma.mission.create({
      data: {
        ...missionData,
        rewardAmount: Number(missionData.rewardAmount),
        maxParticipants: Number(missionData.maxParticipants),
        clientProfileId: clientProfile.id,
        status: 'DRAFT',
        paymentStatus: 'PAID',
        paymentKey: payment.paymentKey,
        orderId: payment.orderId,
        totalAmount: Number(amount),
        paidAt: new Date(payment.approvedAt),
      },
    });

    res.status(201).json({ success: true, data: mission });
  } catch (e) { next(e); }
});

// 기존 미션 결제 확인 — CLIENT 전용 (결제 대기 중인 미션에 대해 결제 완료 처리)
router.patch('/:id/pay', authenticate, requireRole('CLIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentKey, orderId, amount } = req.body;

    // 1. 토스페이먼츠 결제 확인
    const tossSecretKey = process.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) throw new AppError('CONFIG_ERROR', 500, '결제 설정 오류');

    const authHeader = 'Basic ' + Buffer.from(tossSecretKey + ':').toString('base64');
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!tossRes.ok) {
      const err = await tossRes.json().catch(() => ({}));
      throw new AppError('PAYMENT_FAILED', 400, (err as any).message ?? '결제 확인에 실패했습니다');
    }
    const payment = await tossRes.json() as { paymentKey: string; orderId: string; approvedAt: string };

    // 2. 미션 소유권 확인
    const clientProfile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.sub } });
    if (!clientProfile) throw new AppError('PROFILE_REQUIRED', 403, '고객사 프로필이 필요합니다');

    const existing = await prisma.mission.findFirst({
      where: { id: req.params.id, clientProfileId: clientProfile.id, paymentStatus: 'PENDING' },
    });
    if (!existing) throw new AppError('NOT_FOUND', 404, '결제 대기 중인 미션을 찾을 수 없습니다');

    // 3. 결제 완료 처리
    const mission = await prisma.mission.update({
      where: { id: req.params.id },
      data: {
        paymentStatus: 'PAID',
        paymentKey: payment.paymentKey,
        orderId: payment.orderId,
        totalAmount: Number(amount),
        paidAt: new Date(payment.approvedAt),
      },
    });

    res.json({ success: true, data: mission });
  } catch (e) { next(e); }
});

// 미션 상태 변경 (OPERATOR)
router.patch('/:id/status', authenticate, requireRole('OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
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

export default router;
