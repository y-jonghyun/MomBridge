import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { UserRole } from '../../middleware/auth';
import { normalizePhone } from '../../lib/phone';
import { Agreements, consentRows } from './consent';

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
  email: string; password: string; name: string; role: UserRole; phone: string; agreements: Agreements;
}) {
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  if (await findUserByEmail(email)) throw new AppError('EMAIL_EXISTS', 409, '이미 사용 중인 이메일입니다');
  if (await prisma.user.findUnique({ where: { phone } })) throw phoneTaken();

  const passwordHash = await bcrypt.hash(body.password, env.BCRYPT_ROUNDS);
  const user = await createUserWithProfile({
    email, passwordHash, name: body.name, role: body.role, phone, agreements: body.agreements,
  });

  const { tokenVersion, ...publicUser } = user;
  return { user: publicUser, ...signTokens({ ...user, tokenVersion }) };
}

/** 번호가 겹칠 때의 응답. 가입 여부를 넘겨짚지 못하도록 문구는 한 가지만 쓴다 */
const phoneTaken = () => new AppError('PHONE_EXISTS', 409, '이미 가입된 번호예요');

/** 유일 제약과 부딪히는 순간(동시 가입)에도 같은 응답을 주도록 한곳에서 만든다 */
async function createUserWithProfile(input: {
  email: string; passwordHash: string; name: string; role: UserRole; phone: string; agreements: Agreements;
}) {
  try {
    // 사용자와 프로필을 한 번에 만든다 (중첩 create는 한 트랜잭션) — 프로필 없는 계정이 남지 않게
    return await prisma.user.create({
      data: {
        email: input.email, passwordHash: input.passwordHash, name: input.name, role: input.role, phone: input.phone,
        ...(input.role === 'PARTICIPANT' && { participantProfile: { create: { regionSi: '', regionGu: '' } } }),
        ...(input.role === 'CLIENT' && {
          clientProfile: { create: { businessName: input.name, category: '', address: '', regionSi: '', regionGu: '' } },
        }),
        // 동의 기록도 계정과 같은 트랜잭션으로 남긴다
        consents: { create: consentRows(input.agreements) },
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true, tokenVersion: true },
    });
  } catch (err) {
    if (isUniqueViolation(err, 'phone')) throw phoneTaken();
    if (isUniqueViolation(err, 'email')) throw new AppError('EMAIL_EXISTS', 409, '이미 사용 중인 이메일입니다');
    throw err;
  }
}

/** Prisma의 유일 제약 위반(P2002)인지, 어느 칸 때문인지 */
export function isUniqueViolation(err: unknown, field: string): boolean {
  const e = err as { code?: string; meta?: { target?: unknown } };
  if (e?.code !== 'P2002') return false;
  const target = e.meta?.target;
  const names = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  return names.some(n => n === field || n.endsWith(`_${field}_key`));
}

/** 내 번호 바꾸기 — 다른 사람이 쓰는 번호면 가입 때와 같은 문구로 거절한다 */
export async function changePhone(userId: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  try {
    await prisma.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: null } });
  } catch (err) {
    if (isUniqueViolation(err, 'phone')) throw phoneTaken();
    throw err;
  }
  return phone;
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
