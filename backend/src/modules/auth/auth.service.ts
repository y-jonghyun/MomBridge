import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { UserRole } from '../../middleware/auth';

function signTokens(userId: string, email: string, role: UserRole) {
  const payload = { sub: userId, email, role };
  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export async function register(body: {
  email: string; password: string; name: string; role: UserRole;
}) {
  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw new AppError('EMAIL_EXISTS', 409, '이미 사용 중인 이메일입니다');

  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({
    data: { email: body.email, passwordHash, name: body.name, role: body.role },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  if (body.role === 'PARTICIPANT') {
    await prisma.participantProfile.create({ data: { userId: user.id, regionSi: '', regionGu: '' } });
  } else if (body.role === 'CLIENT') {
    await prisma.clientProfile.create({ data: { userId: user.id, businessName: body.name, category: '', address: '', regionSi: '', regionGu: '' } });
  }

  const tokens = signTokens(user.id, user.email, user.role as UserRole);
  return { user, ...tokens };
}

export async function login(body: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.isActive) throw new AppError('INVALID_CREDENTIALS', 401, '이메일 또는 비밀번호가 올바르지 않습니다');

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) throw new AppError('INVALID_CREDENTIALS', 401, '이메일 또는 비밀번호가 올바르지 않습니다');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const tokens = signTokens(user.id, user.email, user.role as UserRole);
  return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...tokens };
}

export async function refresh(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string; email: string; role: UserRole };
    const tokens = signTokens(payload.sub, payload.email, payload.role);
    return tokens;
  } catch {
    throw new AppError('INVALID_TOKEN', 401, '유효하지 않은 리프레시 토큰입니다');
  }
}
