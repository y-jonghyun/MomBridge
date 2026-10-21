import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { parseInput } from '../../middleware/validate';
import { recommendKeywords } from './keyword.service';

const router = Router();

const recommendSchema = z.object({
  category: z.string().trim().min(1, '업종을 입력하세요').max(50),
  region: z.string().trim().min(1, '지역을 입력하세요').max(100),
  product: z.string().trim().max(50).optional(),
  extras: z.array(z.string().trim().max(50)).max(3).optional(),
});

// 사용자당 분당 10회 — 외부 API 호출량 보호 (캐시 적중도 포함해 단순하게 제한)
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  keyGenerator: req => req.user?.sub ?? req.ip ?? 'anonymous',
  standardHeaders: false,
  legacyHeaders: false,
  validate: false,
});

// 키워드 추천 (광고주·운영자)
router.post('/recommend', authenticate, requireRole('CLIENT', 'OPERATOR'), limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseInput(recommendSchema, req.body);
    const result = await recommendKeywords(input);
    res.json({
      success: true,
      data: {
        hints: result.hints,
        source: result.source,
        cached: result.cached,
        stale: result.stale,
        fetchedAt: result.fetchedAt,
        sortMode: result.sortMode,
        rows: result.rows.map(r => ({
          keyword: r.keyword,
          monthlyPc: r.pc.value,
          monthlyPcLow: r.pc.low,
          monthlyMobile: r.mobile.value,
          monthlyMobileLow: r.mobile.low,
          estimatedTotal: r.estimatedTotal,
          compIdx: r.compIdx,
          score: r.score,
          isRegionCategory: r.isRegionCategory,
        })),
      },
    });
  } catch (e) { next(e); }
});

export default router;
