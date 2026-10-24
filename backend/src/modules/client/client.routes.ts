import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { parseInput } from '../../middleware/validate';
import { formatBusinessNumber, isStoreComplete, missingStoreParts, storeSchema } from './store';

const router = Router();
router.use(authenticate, requireRole('CLIENT', 'OPERATOR'));

async function getOrCreateClientProfile(userId: string, name = '') {
  return prisma.clientProfile.upsert({
    where: { userId },
    create: { userId, businessName: name, category: '', address: '', regionSi: '', regionGu: '' },
    update: {},
  });
}

// 내 프로필 조회 — 가게 정보가 다 찼는지도 함께 알려준다
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateClientProfile(req.user!.sub);
    res.json({
      success: true,
      data: {
        ...profile,
        businessNumber: formatBusinessNumber(profile.businessNumber),
        complete: isStoreComplete(profile),
        missing: missingStoreParts(profile),
      },
    });
  } catch (e) { next(e); }
});

// 가게 정보 저장
router.put('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseInput(storeSchema, req.body);
    const profile = await getOrCreateClientProfile(req.user!.sub);
    const updated = await prisma.clientProfile.update({
      where: { id: profile.id },
      data: {
        businessName: input.businessName,
        businessCategory: input.businessCategory,
        address: input.address,
        regionSi: input.regionSi,
        regionGu: input.regionGu,
        regionDong: input.regionDong ?? null,
        businessNumber: input.businessNumber ?? null,
        ...(input.description !== undefined && { description: input.description ?? null }),
      },
    });
    res.json({
      success: true,
      data: { ...updated, businessNumber: formatBusinessNumber(updated.businessNumber), complete: isStoreComplete(updated) },
    });
  } catch (e) { next(e); }
});

// 연락처는 User.phone 하나로 모았다 → PATCH /auth/me/phone 을 쓴다

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

    // 화면은 전어 지원 수와 승인 수만 삼는다 → 지원자 개인정보는 내려보내지 않는다.
    // include로 ParticipantProfile 전체(이름·이메일·지역·자기소개·누적 보상액 등)를 보내던 것을 좁혔다.
    const applications = await prisma.application.findMany({
      where: { missionId: req.params.id },
      select: { id: true, status: true },
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

    // 화면이 쓰는 것만: 작상자 이름, 검수 상태, 설명, 게시글 주소.
    // 운영자 검수 메모(reviewNote·rejectionReason)와 업로드 파일 주소는 고객사 화면에 쓰이지 않아 제외한다.
    const submissions = await prisma.submission.findMany({
      where: { missionId: req.params.id },
      select: {
        id: true, status: true, description: true, snsPostUrl: true,
        participant: { select: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: submissions });
  } catch (e) { next(e); }
});

export default router;
