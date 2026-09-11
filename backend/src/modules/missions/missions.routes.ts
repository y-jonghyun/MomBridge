import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

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

// 미션 생성 (CLIENT, OPERATOR)
router.post('/', authenticate, requireRole('CLIENT', 'OPERATOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const clientProfile = await prisma.clientProfile.findUnique({ where: { userId: user.sub } });
    if (!clientProfile) throw new AppError('PROFILE_REQUIRED', 403, '고객사 프로필이 필요합니다');

    const mission = await prisma.mission.create({
      data: {
        ...req.body,
        clientProfileId: clientProfile.id,
        status: 'DRAFT',
      },
    });
    res.status(201).json({ success: true, data: mission });
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
