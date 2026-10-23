import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
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

/** 한 사람이 10분에 30장까지 — 변환·저장소 비용이 드는 경로라 횟수를 묶는다 */
const uploadLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 30,
  keyGenerator: req => req.user?.sub ?? req.ip ?? 'anonymous',
  standardHeaders: false,
  legacyHeaders: false,
  validate: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'TOO_MANY_UPLOADS', message: '사진을 너무 많이 올렸습니다. 잠시 후 다시 시도해 주세요' },
    });
  },
});

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

/**
 * multer를 감싸 업로드 중 생긴 오류를 400으로 바꾼다.
 * 한도 초과는 MulterError라 errorHandler가 처리하지만, 본문이 중간에 끊기면
 * busboy가 그냥 Error를 던져서 그대로 두면 500이 된다 — 보낸 쪽 잘못이므로 400이 맞다.
 */
function uploadImage(req: Request, res: Response, next: NextFunction) {
  upload.single('image')(req, res, (err?: unknown) => {
    if (!err) return next();
    if ((err as { name?: string }).name === 'MulterError') return next(err);
    next(new AppError('INVALID_UPLOAD', 400, '사진 전송이 중간에 끊겼습니다. 다시 시도해 주세요'));
  });
}

/** 권한 확인을 미들웨어로 — 파일을 읽기 전에 먼저 돌린다 */
async function editorOnly(req: Request, res: Response, next: NextFunction) {
  try {
    res.locals.missionId = await requireMissionEditor(req);
    next();
  } catch (e) { next(e); }
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

// 한 장 올리기.
// 횟수 제한 → 권한 확인 → multer 순서다. 권한이 없는 사람의 파일은 읽지도 않는다
router.post('/', uploadLimiter, editorOnly, uploadImage, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const missionId = String(res.locals.missionId);
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
