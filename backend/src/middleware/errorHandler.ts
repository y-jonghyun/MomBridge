import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { areaForPath, captureError } from '../lib/monitoring';

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** multer가 한도를 넘는 업로드를 끊었을 때 — 500이 아니라 400으로 답한다 */
function multerMessage(code: string): string | null {
  switch (code) {
    case 'LIMIT_FILE_SIZE': return '사진 한 장은 5MB까지 올릴 수 있습니다';
    case 'LIMIT_FILE_COUNT': return '사진은 한 번에 한 장씩 올려 주세요';
    case 'LIMIT_UNEXPECTED_FILE': return '사진 항목 이름이 올바르지 않습니다';
    default: return null;
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const maybeMulter = err as { name?: string; code?: string };
  if (maybeMulter?.name === 'MulterError' && maybeMulter.code) {
    const message = multerMessage(maybeMulter.code);
    if (message) {
      res.status(400).json({ success: false, error: { code: 'IMAGE_TOO_LARGE', message } });
      return;
    }
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) captureError(err, { area: areaForPath(req.originalUrl), path: req.path, userId: req.user?.sub });
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // body-parser 오류: 본문이 너무 큼(413), JSON 형식 오류(400) — 클라이언트 잘못이라 500으로 보내지 않는다
  const type = (err as { type?: string })?.type;
  if (type === 'entity.too.large') {
    res.status(413).json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: '요청 내용이 너무 큽니다' } });
    return;
  }
  if (type === 'entity.parse.failed') {
    res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: '요청 형식이 올바르지 않습니다' } });
    return;
  }

  logger.error('Unhandled error', { err, path: req.path });
  captureError(err, { area: areaForPath(req.originalUrl), path: req.originalUrl.split('?')[0], userId: req.user?.sub });
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}
