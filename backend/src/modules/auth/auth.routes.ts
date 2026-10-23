import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import * as authService from './auth.service';
import { confirmPasswordReset, requestPasswordReset } from './password-reset';
import { parseInput } from '../../middleware/validate';
import { loginPerEmail, loginPerIp, registerPerIp, resetConfirmPerIp, resetRequestPerIp } from './auth-limits';
import { isMobilePhone, normalizePhone } from '../../lib/phone';
import { agreementsSchema } from './consent';

const router = Router();

/** 휴대폰 번호 — 하이픈은 있어도 되고, 저장은 숫자만 한다 */
const phoneSchema = z.string()
  .trim()
  .min(1, '휴대폰 번호를 입력해주세요')
  .max(20)
  .transform(normalizePhone)
  .refine(isMobilePhone, { message: '010으로 시작하는 휴대폰 번호를 입력해주세요' });

// 회원가입으로는 참여자·고객사만 만들 수 있다. 운영자 계정은 서버에서 scripts/create-operator로만 만든다
const registerSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다').max(100),
  name: z.string().trim().min(1, '이름을 입력해주세요').max(100),
  role: z.enum(['PARTICIPANT', 'CLIENT'], { errorMap: () => ({ message: '참여자 또는 고객사로만 가입할 수 있습니다' }) }),
  phone: phoneSchema,
  agreements: agreementsSchema,
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
const resetRequestSchema = z.object({ email: z.string().trim().email().max(320) });
const resetConfirmSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(6, '비밀번호는 6자 이상이어야 합니다').max(100),
});

// 계정이 없어도 같은 응답 (가입 여부를 알려 주지 않음)
router.post('/password-reset/request', resetRequestPerIp, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await requestPasswordReset(parseInput(resetRequestSchema, req.body).email);
    res.json({ success: true, data: { message: '가입된 이메일이면 재설정 링크를 보냈습니다. 메일함을 확인해 주세요' } });
  } catch (e) { next(e); }
});

router.post('/password-reset/confirm', resetConfirmPerIp, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = parseInput(resetConfirmSchema, req.body);
    await confirmPasswordReset(token, newPassword);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// 내 정보. 번호는 본인에게만 전체로 보여준다
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { name: true, phone: true, phoneVerifiedAt: true },
    });
    res.json({ success: true, data: { user: { ...req.user, ...row } } });
  } catch (e) { next(e); }
});

// 휴대폰 번호 변경
router.patch('/me/phone', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = parseInput(z.object({ phone: phoneSchema }), req.body);
    await authService.changePhone(req.user!.sub, phone);
    res.json({ success: true });
  } catch (e) { next(e); }
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
