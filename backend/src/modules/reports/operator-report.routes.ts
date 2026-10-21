import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { addDays, clock, formatDay, kstDayKey, parseDay } from '../../lib/clock';
import { buildOperatorSummary, resolveRange, summaryToCsv } from './report.service';

/** 운영자용 유입 집계 — /operator/reports */
const router = Router();
router.use(authenticate, requireRole('OPERATOR'));

// 기본 기간: 최근 30일
const defaultFrom = () => addDays(kstDayKey(clock.now()), -29);

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = resolveRange(parseDay(req.query.from), parseDay(req.query.to), defaultFrom());
    res.json({ success: true, data: await buildOperatorSummary(range) });
  } catch (e) { next(e); }
});

router.get('/export.csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = resolveRange(parseDay(req.query.from), parseDay(req.query.to), defaultFrom());
    const csv = summaryToCsv(await buildOperatorSummary(range));
    res.set('Content-Type', 'text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="mombridge-traffic-${formatDay(range.from)}_${formatDay(range.to)}.csv"`)
      .send(csv);
  } catch (e) { next(e); }
});

export default router;
