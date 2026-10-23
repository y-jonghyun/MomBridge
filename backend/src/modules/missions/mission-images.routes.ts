import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { parseInput } from '../../middleware/validate';
import {
  MAX_BYTES, MAX_IMAGES, addMissionImage, removeMissionImage, reorderMissionImages,
} from './mission-images';

/**
 * 미션 사진 — /api/v1/missions/:id/images
 * 그 미션의 고객사 본인이나 운영자만 올리고 지울 수 있다.
 */
const router = Router({ mergeParams: true });

// 파일은 메모리에서 바로 변환해 저장소로 보낸다 (디스크에 남기지 않는다).
// 한도를 넘는 요청은 multer가 먼저 끊는다 — 큰 파일을 끝까지 읽지 않기 위해서다
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

/** 이 미션의 사진을 바꿀 수 있는 사람인지 */
async function requireMissionEditor(req: Request): Promise<string> {
  const missionId = String(req.params.id);
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { id: true, clientProfile: { select: { userId: true } } },
  });
  if (!mission) throw new AppError('NOT_FOUND', 404, '미션을 찾을 수 없습니다');

  const role = req.user!.role;
  if (role === 'OPERATOR') return mission.id;
  if (role === 'CLIENT' && mission.clientProfile?.userId === req.user!.sub) return mission.id;
  throw new AppError('FORBIDDEN', 403, '이 미션의 사진을 바꿀 수 없습니다');
}

router.use(authenticate);

// 목록 (편집 화면용 — 공개 조회는 미션 상세에 함께 담긴다)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const missionId = await requireMissionEditor(req);
    const images = await prisma.missionImage.findMany({
      where: { missionId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, url: true, sortOrder: true },
    });
    res.json({ success: true, data: images });
  } catch (e) { next(e); }
});

// 한 장 올리기
router.post('/', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const missionId = await requireMissionEditor(req);
    const file = req.file;
    if (!file) throw new AppError('INVALID_INPUT', 400, '사진 파일이 없습니다');

    const image = await addMissionImage(missionId, file);
    res.status(201).json({ success: true, data: { id: image.id, url: image.url, sortOrder: image.sortOrder } });
  } catch (e) { next(e); }
});

const orderSchema = z.object({ imageIds: z.array(z.string().uuid()).min(1).max(MAX_IMAGES) });

// 순서 바꾸기 (첫 장이 대표 사진)
router.patch('/order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const missionId = await requireMissionEditor(req);
    const { imageIds } = parseInput(orderSchema, req.body);
    await reorderMissionImages(missionId, imageIds);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// 한 장 지우기
router.delete('/:imageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const missionId = await requireMissionEditor(req);
    await removeMissionImage(missionId, String(req.params.imageId));
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
