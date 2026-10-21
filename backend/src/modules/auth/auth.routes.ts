import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import * as authService from './auth.service';
import rateLimit from 'express-rate-limit';
import { confirmPasswordReset, requestPasswordReset } from './password-reset';
import { parseInput } from '../../middleware/validate';
import { loginPerEmail, loginPerIp, registerPerIp } from './auth-limits';

const router = Router();

// 회원가입으로는 참여자·고객사만 만들 수 있다. 운영자 계정은 서버에서 scripts/create-operator로만 만든다
const registerSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다').max(100),
  name: z.string().trim().min(1, '이름을 입력해주세요').max(100),
  role: z.enum(['PARTICIPANT', 'CLIENT'], { errorMap: () => ({ message: '참여자 또는 고객사로만 가입할 수 있습니다' }) }),
  phone: z.preprocess(v => (v === '' ? undefined : v), z.string().trim().max(20).optional()),
});

router.post('/register', registerPerIp, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.register(parseInput(registerSchema, req.body));
    res.status(201).json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post('/login', loginPerIp, loginPerEmail, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.body.refreshToken ?? req.cookies?.refreshToken;
    const result = await authService.refresh(token);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

// ── 비밀번호 재설정 ──
const resetLimiter = (limit: number) => rateLimit({
  windowMs: 15 * 60_000, limit, standardHeaders: 'draft-7', legacyHeaders: false, validate: false,
  handler: (_req, res) => res.status(429).json({ success: false, error: { code: 'TOO_MANY_ATTEMPTS', message: '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요' } }),
});
const resetRequestSchema = z.object({ email: z.string().trim().email().max(320) });
const resetConfirmSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(6, '비밀번호는 6자 이상이어야 합니다').max(100),
});

// 계정이 없어도 같은 응답 (가입 여부를 알려 주지 않음)
router.post('/password-reset/request', resetLimiter(5), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await requestPasswordReset(parseInput(resetRequestSchema, req.body).email);
    res.json({ success: true, data: { message: '가입된 이메일이면 재설정 링크를 보냈습니다. 메일함을 확인해 주세요' } });
  } catch (e) { next(e); }
});

router.post('/password-reset/confirm', resetLimiter(20), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = parseInput(resetConfirmSchema, req.body);
    await confirmPasswordReset(token, newPassword);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: { user: req.user } });
});

// 이름 변경
router.patch('/me/name', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) throw new AppError('INVALID_INPUT', 400, '이름을 입력해주세요');
    await prisma.user.update({ where: { id: req.user!.sub }, data: { name: name.trim() } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// 비밀번호 변경
router.patch('/me/password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new AppError('INVALID_INPUT', 400, '현재 비밀번호와 새 비밀번호를 입력해주세요');
    if (newPassword.length < 6) throw new AppError('INVALID_INPUT', 400, '비밀번호는 6자 이상이어야 합니다');

    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw new AppError('NOT_FOUND', 404, '사용자를 찾을 수 없습니다');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError('INVALID_PASSWORD', 400, '현재 비밀번호가 올바르지 않습니다');

    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    // 다른 기기의 세션은 끊고, 지금 세션에는 새 토큰을 준다
    const updated = await prisma.user.update({
      where: { id: req.user!.sub }, data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    res.json({ success: true, data: authService.signTokens(updated) });
  } catch (e) { next(e); }
});

export default router;
