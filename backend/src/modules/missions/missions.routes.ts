import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { sendAlimTalk } from '../../utils/sms';
import { parseInput } from '../../middleware/validate';
import {
  operatorCreateMissionSchema, payAndCreateMissionSchema, payExistingMissionSchema,
  missionStatusSchema, expectedMissionAmount,
} from './missions.schema';
import { newCampaignCode, normalizeMissionKeywords, saveMissionKeywords } from './mission-extras';
import { logger } from '../../utils/logger';

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
        // 고객사가 고른 메인·서브 키워드 (검색량 같은 내부 수치는 공개하지 않음)
        keywords: { select: { keyword: true, role: true }, orderBy: [{ role: 'asc' }, { snapshotAt: 'asc' }] },
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
    const { clientProfileId: requestedProfileId, sendPaymentLink: sendLinkInput, keywords, ...missionData } =
      parseInput(operatorCreateMissionSchema, req.body);
    let clientProfileId = requestedProfileId;
    if (!clientProfileId) {
      const ownProfile = await prisma.clientProfile.findUnique({ where: { userId: user.sub } });
      if (!ownProfile) throw new AppError('PROFILE_REQUIRED', 403, 'clientProfileId가 필요합니다');
      clientProfileId = ownProfile.id;
    }

    const sendPaymentLink = !!sendLinkInput;

    const mission = await prisma.mission.create({
      data: {
        ...missionData,
        clientProfileId,
        campaignCode: await newCampaignCode(),
        status: 'DRAFT',
        paymentStatus: sendPaymentLink ? 'PENDING' : 'WAIVED',
      },
    });
    if (keywords) await saveMissionKeywords(mission.id, keywords);

    // 결제 링크 SMS/알림톡 발송
    if (sendPaymentLink) {
      const clientProfile = await prisma.clientProfile.findUnique({
        where: { id: clientProfileId },
        select: { contactPhone: true, businessName: true },
      });
      // 존재하지 않는 기본 도메인으로 결제 링크를 보내지 않도록 FRONTEND_URL이 없으면 발송하지 않는다
      if (clientProfile?.contactPhone && !env.FRONTEND_URL) {
        logger.error('FRONTEND_URL is not set; payment link SMS skipped', { missionId: mission.id });
      } else if (clientProfile?.contactPhone) {
        const paymentUrl = `${env.FRONTEND_URL}/client`;
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
    // 0. 입력 검증 — 결제 승인 전에 해야 결제만 되고 미션이 안 만들어지는 일이 없다
    const { paymentKey, orderId, amount, keywords, ...missionData } = parseInput(payAndCreateMissionSchema, req.body);
    if (amount !== expectedMissionAmount(missionData.rewardAmount, missionData.maxParticipants)) {
      throw new AppError('AMOUNT_MISMATCH', 400, '결제 금액이 미션 금액(보상 × 인원)과 일치하지 않습니다');
    }
    const clientProfile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.sub } });
    if (!clientProfile) throw new AppError('PROFILE_REQUIRED', 403, '고객사 프로필이 필요합니다');
    if (keywords) await normalizeMissionKeywords(keywords);

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

    // 2. 미션 생성
    const mission = await prisma.mission.create({
      data: {
        ...missionData,
        clientProfileId: clientProfile.id,
        campaignCode: await newCampaignCode(),
        status: 'DRAFT',
        paymentStatus: 'PAID',
        paymentKey: payment.paymentKey,
        orderId: payment.orderId,
        totalAmount: Number(amount),
        paidAt: new Date(payment.approvedAt),
      },
    });
    // 결제는 이미 끝났으므로 키워드 저장 실패가 미션 생성을 되돌리지 않게 한다 (생성 후 수정 가능)
    if (keywords) {
      await saveMissionKeywords(mission.id, keywords)
        .catch(err => logger.warn('mission keywords save failed after payment', { missionId: mission.id, error: (err as Error).name }));
    }

    res.status(201).json({ success: true, data: mission });
  } catch (e) { next(e); }
});

// 기존 미션 결제 확인 — CLIENT 전용 (결제 대기 중인 미션에 대해 결제 완료 처리)
router.patch('/:id/pay', authenticate, requireRole('CLIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentKey, orderId, amount } = parseInput(payExistingMissionSchema, req.body);

    // 0. 미션 소유권·금액 확인 — 결제 승인 전에 검사한다
    const clientProfile = await prisma.clientProfile.findUnique({ where: { userId: req.user!.sub } });
    if (!clientProfile) throw new AppError('PROFILE_REQUIRED', 403, '고객사 프로필이 필요합니다');

    const existing = await prisma.mission.findFirst({
      where: { id: req.params.id, clientProfileId: clientProfile.id, paymentStatus: 'PENDING' },
    });
    if (!existing) throw new AppError('NOT_FOUND', 404, '결제 대기 중인 미션을 찾을 수 없습니다');
    if (amount !== expectedMissionAmount(Number(existing.rewardAmount), existing.maxParticipants)) {
      throw new AppError('AMOUNT_MISMATCH', 400, '결제 금액이 미션 금액(보상 × 인원)과 일치하지 않습니다');
    }

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

    // 2. 결제 완료 처리
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

export default router;
