import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { UserRole } from '../../middleware/auth';

/** 이메일은 소문자로 저장·비교한다 (대소문자만 다른 중복 계정 방지) */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** 정규화 전에 대소문자 섞어 가입한 기존 계정도 찾도록 대소문자 무시로 조회 */
export function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: normalizeEmail(email), mode: 'insensitive' } } });
}

type TokenUser = { id: string; email: string; role: UserRole | string; tokenVersion: number };

export function signTokens(user: TokenUser) {
  const payload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions);
  const refreshToken = jwt.sign({ ...payload, tv: user.tokenVersion }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export async function register(body: {
  email: string; password: string; name: string; role: UserRole; phone?: string;
}) {
  const email = normalizeEmail(body.email);
  if (await findUserByEmail(email)) throw new AppError('EMAIL_EXISTS', 409, '이미 사용 중인 이메일입니다');

  const passwordHash = await bcrypt.hash(body.password, env.BCRYPT_ROUNDS);
  // 사용자와 프로필을 한 번에 만든다 (중첩 create는 한 트랜잭션) — 프로필 없는 계정이 남지 않게
  const user = await prisma.user.create({
    data: {
      email, passwordHash, name: body.name, role: body.role,
      ...(body.role === 'PARTICIPANT' && { participantProfile: { create: { regionSi: '', regionGu: '' } } }),
      ...(body.role === 'CLIENT' && {
        clientProfile: {
          create: {
            businessName: body.name, category: '', address: '', regionSi: '', regionGu: '',
            ...(body.phone ? { contactPhone: body.phone } : {}),
          },
        },
      }),
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true, tokenVersion: true },
  });

  const { tokenVersion, ...publicUser } = user;
  return { user: publicUser, ...signTokens({ ...user, tokenVersion }) };
}

export async function login(body: { email: string; password: string }) {
  const user = typeof body.email === 'string' ? await findUserByEmail(body.email) : null;
  if (!user || !user.isActive || user.deletedAt) throw new AppError('INVALID_CREDENTIALS', 401, '이메일 또는 비밀번호가 올바르지 않습니다');

  const valid = await bcrypt.compare(String(body.password ?? ''), user.passwordHash);
  if (!valid) throw new AppError('INVALID_CREDENTIALS', 401, '이메일 또는 비밀번호가 올바르지 않습니다');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...signTokens(user) };
}

/** 토큰 서명만 보지 않고 계정 상태와 토큰 버전을 확인한 뒤 재발급한다 */
export async function refresh(refreshToken: unknown) {
  const invalid = new AppError('INVALID_TOKEN', 401, '유효하지 않은 리프레시 토큰입니다');
  if (typeof refreshToken !== 'string' || !refreshToken) throw invalid;
  let payload: { sub: string; tv?: number };
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as typeof payload;
  } catch {
    throw invalid;
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  // tv가 없는 토큰은 이 변경 전에 발급된 것 → 버전 0으로 본다 (배포 직후 전원 로그아웃 방지)
  if (!user || !user.isActive || user.deletedAt || user.tokenVersion !== (payload.tv ?? 0)) throw invalid;
  return signTokens(user);
}

/** 이 사용자의 기존 리프레시 토큰을 모두 무효화한다 */
export function revokeSessions(userId: string) {
  return prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
}
