import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { parseInput } from '../../middleware/validate';
import { getSetting } from '../settings/settings';
import { diagnoseBlogPost } from './diagnose';

/**
 * 운영자 점검 도구 — /operator/tools
 * 배포 서버(Render)에서 네이버 블로그 글 1건을 조회해 확인 로직과 접근 차단 여부를 점검한다. 저장하지 않는다.
 */
const router = Router();
router.use(authenticate, requireRole('OPERATOR'));

const schema = z.object({
  url: z.string().trim().min(1).max(2048),
  trackingCode: z.string().trim().max(16).optional(),
  mainKeyword: z.string().trim().max(100).optional(),
});

// 점검용이므로 운영자당 분당 5회 (대량 조회 방지)
const limiter = rateLimit({
  windowMs: 60_000, limit: 5, keyGenerator: req => req.user?.sub ?? 'unknown', standardHeaders: false, legacyHeaders: false, validate: false,
});

router.post('/check-blog-post', limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseInput(schema, req.body);
    const [phrases, topChars] = await Promise.all([getSetting('submission.disclosurePhrases'), getSetting('submission.disclosureTopChars')]);
    const report = await diagnoseBlogPost(input.url, {
      trackingCode: input.trackingCode || null,
      mainKeyword: input.mainKeyword || null,
      disclosurePhrases: phrases,
      topChars,
    }, 'server');
    res.json({ success: true, data: report });
  } catch (e) { next(e); }
});

export default router;
