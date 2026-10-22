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

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
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
