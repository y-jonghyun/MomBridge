import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { parseInput } from '../../middleware/validate';
import { normalizeProvince } from '../../lib/regions';
import { isProfileComplete, snsAccountSchema } from './profile';

/**
 * 참여자 프로필 — /api/v1/participant/profile
 * 활동 지역·자녀 연령대·SNS 계정. 모두 로그인한 본인 것만 읽고 쓴다.
 */
const router = Router({ mergeParams: true });

async function myProfile(userId: string) {
  return prisma.participantProfile.upsert({
    where: { userId },
    create: { userId, regionSi: '', regionGu: '' },
    update: {},
  });
}

const CHILD_AGE_GROUPS = ['INFANT', 'TODDLER', 'ELEMENTARY', 'NONE'] as const;

const profileSchema = z.object({
  regionSi: z.string().trim().min(1, '시·도를 선택해 주세요').max(50).transform((v, ctx) => {
    const name = normalizeProvince(v);
    if (!name) { ctx.addIssue({ code: 'custom', message: '시·도를 선택해 주세요 (예: 충청북도)' }); return z.NEVER; }
    return name;
  }),
  regionGu: z.string().trim().min(1, '시·군·구를 선택해 주세요').max(50),
  regionDong: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().trim().max(50).optional()),
  childAgeGroups: z.array(z.enum(CHILD_AGE_GROUPS)).max(4).optional(),
  bio: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().trim().max(1000).optional()),
});

/** 내 프로필 + SNS 계정 + 완성 여부 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await myProfile(req.user!.sub);
    const snsAccounts = await prisma.snsAccount.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, platform: true, handle: true, url: true, createdAt: true },
    });
    res.json({
      success: true,
      data: { ...profile, snsAccounts, complete: isProfileComplete(profile, snsAccounts) },
    });
  } catch (e) { next(e); }
});

/** 활동 지역·자녀 연령대 저장 */
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseInput(profileSchema, req.body);
    const profile = await myProfile(req.user!.sub);
    const updated = await prisma.participantProfile.update({
      where: { id: profile.id },
      data: {
        regionSi: input.regionSi,
        regionGu: input.regionGu,
        regionDong: input.regionDong ?? null,
        ...(input.childAgeGroups && { childAgeGroups: input.childAgeGroups }),
        ...(input.bio !== undefined && { bio: input.bio ?? null }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// ── SNS 계정 ──
// 플랫폼마다 한 개씩만 등록할 수 있다 (스키마의 [profileId, platform] 유일 제약).

router.post('/sns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseInput(snsAccountSchema, req.body);
    const profile = await myProfile(req.user!.sub);

    const exists = await prisma.snsAccount.findUnique({
      where: { profileId_platform: { profileId: profile.id, platform: input.platform } },
    });
    if (exists) throw new AppError('SNS_EXISTS', 409, '이미 등록한 채널이에요. 주소를 바꾸려면 고쳐 주세요');

    const account = await prisma.snsAccount.create({
      data: { profileId: profile.id, platform: input.platform, url: input.url, handle: input.handle },
      select: { id: true, platform: true, handle: true, url: true, createdAt: true },
    });
    res.status(201).json({ success: true, data: account });
  } catch (e) { next(e); }
});

router.patch('/sns/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseInput(snsAccountSchema, req.body);
    const profile = await myProfile(req.user!.sub);

    // 남의 계정을 고치지 못하게 내 프로필 것만 찾는다
    const mine = await prisma.snsAccount.findFirst({ where: { id: req.params.id, profileId: profile.id } });
    if (!mine) throw new AppError('NOT_FOUND', 404, 'SNS 계정을 찾을 수 없습니다');

    if (input.platform !== mine.platform) {
      const taken = await prisma.snsAccount.findUnique({
        where: { profileId_platform: { profileId: profile.id, platform: input.platform } },
      });
      if (taken) throw new AppError('SNS_EXISTS', 409, '이미 등록한 채널이에요. 주소를 바꾸려면 고쳐 주세요');
    }

    const account = await prisma.snsAccount.update({
      where: { id: mine.id },
      data: { platform: input.platform, url: input.url, handle: input.handle },
      select: { id: true, platform: true, handle: true, url: true, createdAt: true },
    });
    res.json({ success: true, data: account });
  } catch (e) { next(e); }
});

router.delete('/sns/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await myProfile(req.user!.sub);
    const { count } = await prisma.snsAccount.deleteMany({
      where: { id: req.params.id, profileId: profile.id },
    });
    if (count === 0) throw new AppError('NOT_FOUND', 404, 'SNS 계정을 찾을 수 없습니다');
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
