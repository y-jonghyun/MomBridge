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

  logger.error('Unhandled error', { err, path: req.path });
  captureError(err, { area: areaForPath(req.originalUrl), path: req.originalUrl.split('?')[0], userId: req.user?.sub });
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}
