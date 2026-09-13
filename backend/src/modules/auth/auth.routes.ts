import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import bcrypt from 'bcryptjs';
import * as authService from './auth.service';

const router = Router();

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
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

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user!.sub }, data: { passwordHash } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
