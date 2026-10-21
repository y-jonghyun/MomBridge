import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { runDailyJob } from './daily-job';

/** 내부 배치 — GitHub Actions cron이 X-Internal-Token 헤더로 호출 */
const router = Router();

function requireJobToken(req: Request, _res: Response, next: NextFunction) {
  const given = Buffer.from(req.get('x-internal-token') ?? '');
  const expected = Buffer.from(env.INTERNAL_JOB_TOKEN);
  if (!env.INTERNAL_JOB_TOKEN || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    next(new AppError('NOT_FOUND', 404, 'Not found'));
    return;
  }
  next();
}

router.post('/jobs/daily', requireJobToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runDailyJob();
    logger.info('daily job finished', { ...result });
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

export default router;
