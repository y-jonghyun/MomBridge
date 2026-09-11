import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';

const router = Router();

const postInclude = {
  user: { select: { id: true, name: true, role: true } },
  _count: { select: { comments: true, likes: true } },
};

// 게시글 목록
router.get('/posts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(String(req.query.page ?? '1'), 10);
    const limit = parseInt(String(req.query.limit ?? '20'), 10);
    const category = req.query.category as string | undefined;
    const sort = req.query.sort as string | undefined;
    const keyword = req.query.keyword as string | undefined;

    const where: any = {
      ...(category && category !== 'ALL' && { category }),
      ...(keyword && {
        OR: [
          { title: { contains: keyword } },
          { content: { contains: keyword } },
        ],
      }),
    };

    const orderBy: any =
      sort === 'POPULAR' ? [{ likeCount: 'desc' }, { createdAt: 'desc' }] :
      sort === 'VIEWS'   ? [{ viewCount: 'desc' }, { createdAt: 'desc' }] :
                           [{ createdAt: 'desc' }];

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where, orderBy,
        skip: (page - 1) * limit, take: limit,
        include: postInclude,
      }),
      prisma.communityPost.count({ where }),
    ]);

    res.json({ success: true, data: { posts, total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
});

// 베스트 게시글 (좋아요 상위 5개)
router.get('/posts/best', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await prisma.communityPost.findMany({
      orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      include: postInclude,
    });
    res.json({ success: true, data: posts });
  } catch (e) { next(e); }
});

// 게시글 상세
router.get('/posts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.communityPost.update({ where: { id: req.params.id }, data: { viewCount: { increment: 1 } } });
    const post = await prisma.communityPost.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, role: true } },
        comments: {
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { comments: true, likes: true } },
      },
    });
    res.json({ success: true, data: post });
  } catch (e) { next(e); }
});

// 게시글 작성
router.post('/posts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await prisma.communityPost.create({
      data: {
        userId: req.user!.sub,
        category: req.body.category,
        title: req.body.title,
        content: req.body.content,
      },
      include: postInclude,
    });
    res.status(201).json({ success: true, data: post });
  } catch (e) { next(e); }
});

// 게시글 수정
router.patch('/posts/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) { res.status(404).json({ success: false }); return; }
    if (post.userId !== req.user!.sub && req.user!.role !== 'OPERATOR') {
      res.status(403).json({ success: false }); return;
    }
    const updated = await prisma.communityPost.update({
      where: { id: req.params.id },
      data: { title: req.body.title, content: req.body.content, category: req.body.category },
      include: postInclude,
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// 게시글 삭제
router.delete('/posts/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
    if (!post) { res.status(404).json({ success: false }); return; }
    if (post.userId !== req.user!.sub && req.user!.role !== 'OPERATOR') {
      res.status(403).json({ success: false }); return;
    }
    await prisma.communityPost.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// 좋아요 토글
router.post('/posts/:id/like', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.communityLike.findUnique({
      where: { postId_userId: { postId: req.params.id, userId: req.user!.sub } },
    });
    if (existing) {
      await prisma.communityLike.delete({
        where: { postId_userId: { postId: req.params.id, userId: req.user!.sub } },
      });
      await prisma.communityPost.update({ where: { id: req.params.id }, data: { likeCount: { decrement: 1 } } });
      res.json({ success: true, liked: false });
    } else {
      await prisma.communityLike.create({ data: { postId: req.params.id, userId: req.user!.sub } });
      await prisma.communityPost.update({ where: { id: req.params.id }, data: { likeCount: { increment: 1 } } });
      res.json({ success: true, liked: true });
    }
  } catch (e) { next(e); }
});

// 댓글 작성
router.post('/posts/:id/comments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comment = await prisma.communityComment.create({
      data: { postId: req.params.id, userId: req.user!.sub, content: req.body.content },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    res.status(201).json({ success: true, data: comment });
  } catch (e) { next(e); }
});

// 댓글 삭제
router.delete('/posts/:postId/comments/:commentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comment = await prisma.communityComment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) { res.status(404).json({ success: false }); return; }
    if (comment.userId !== req.user!.sub && req.user!.role !== 'OPERATOR') {
      res.status(403).json({ success: false }); return;
    }
    await prisma.communityComment.delete({ where: { id: req.params.commentId } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
