import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
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

export default router;
