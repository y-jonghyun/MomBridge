import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { prisma } from '../../config/database';

const router = Router();
router.use(authenticate);

// 내 알림 목록
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.sub, isRead: false },
    });
    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (e) { next(e); }
});

// 전체 읽음 처리
router.patch('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.sub, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// 개별 읽음 처리
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.sub },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
