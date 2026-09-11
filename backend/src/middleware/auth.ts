import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './errorHandler';

export type UserRole = 'OPERATOR' | 'PARTICIPANT' | 'CLIENT';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    next(new AppError('MISSING_TOKEN', 401, '인증 토큰이 필요합니다'));
    return;
  }
  const token = auth.slice(7);
  try {
    req.user = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    next();
  } catch {
    next(new AppError('INVALID_TOKEN', 401, '유효하지 않은 토큰입니다'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) { next(new AppError('UNAUTHORIZED', 401, '인증이 필요합니다')); return; }
    if (!roles.includes(req.user.role)) {
      next(new AppError('FORBIDDEN', 403, '접근 권한이 없습니다')); return;
    }
    next();
  };
}
