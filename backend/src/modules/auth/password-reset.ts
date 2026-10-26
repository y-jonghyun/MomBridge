import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { clock } from '../../lib/clock';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { mailConfigured, mailer } from '../../utils/mailer';
import { findUserByEmail } from './auth.service';

const TOKEN_TTL_MS = 30 * 60_000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** 재설정 기능을 쓸 수 있는지 (메일 발송 설정 + 링크에 넣을 프론트 주소) */
export const passwordResetAvailable = () => mailConfigured() && !!env.FRONTEND_URL;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function resetMail(name: string, link: string) {
  const text = [
    `${name}님, 맘브릿지 비밀번호 재설정 요청을 받았습니다.`,
    '',
    '아래 링크에서 새 비밀번호를 정해 주세요. 링크는 30분 동안 한 번만 쓸 수 있습니다.',
    link,
    '',
    '직접 요청하지 않았다면 이 메일을 무시하세요. 비밀번호는 바뀌지 않습니다.',
  ].join('\n');
  const html = `<p>${escapeHtml(name)}님, 맘브릿지 비밀번호 재설정 요청을 받았습니다.</p>
<p>아래 버튼을 눌러 새 비밀번호를 정해 주세요. 링크는 30분 동안 한 번만 쓸 수 있습니다.</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#334155;color:#fff;border-radius:8px;text-decoration:none">비밀번호 재설정</a></p>
<p style="color:#888;font-size:12px">직접 요청하지 않았다면 이 메일을 무시하세요. 비밀번호는 바뀌지 않습니다.</p>`;
  return { subject: '[맘브릿지] 비밀번호 재설정 안내', text, html };
}

/**
 * 재설정 메일 요청. 계정이 있든 없든 호출자에게는 같은 결과를 준다(가입 여부 노출 방지).
 * 메일은 응답과 별개로 보낸다 — 계정 유무에 따라 응답 시간이 달라지지 않게.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!passwordResetAvailable()) {
    throw new AppError('RESET_UNAVAILABLE', 503, '지금은 비밀번호 재설정 메일을 보낼 수 없습니다. 운영자에게 문의해 주세요');
  }
  void (async () => {
    const user = await findUserByEmail(email);
    if (!user || !user.isActive || user.deletedAt) return;
    // 운영자가 대신 만든 가게 계정에는 메일을 보내지 않는다 (받는 사람이 없는 내부용 주소다)
    if (user.managedByOperator) return;

    const token = randomBytes(32).toString('base64url');
    const now = clock.now();
    // 이전에 보낸 링크는 무효로 하고 새 링크 하나만 남긴다
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS) },
      }),
    ]);
    const link = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    await mailer.send({ to: user.email, ...resetMail(user.name, link) });
  })().catch(err => logger.error('password reset mail failed', { error: (err as Error).message }));
}

/** 새 비밀번호 설정. 토큰은 한 번만 쓸 수 있고, 성공하면 모든 기기의 로그인을 끊는다 */
export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const invalid = new AppError('INVALID_RESET_TOKEN', 400, '링크가 만료됐거나 이미 사용됐습니다. 재설정을 다시 요청해 주세요');
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  const now = clock.now();
  if (!row || row.usedAt || row.expiresAt <= now || !row.user.isActive || row.user.deletedAt) throw invalid;

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  // 같은 토큰으로 동시에 두 번 요청해도 한 번만 성공하게 usedAt이 비어 있을 때만 표시한다
  const claimed = await prisma.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (claimed.count !== 1) throw invalid;
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash, tokenVersion: { increment: 1 } } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } }),
  ]);
}

/** 일 배치: 만료된 지 하루 지난 토큰 삭제 */
export async function deleteExpiredResetTokens(now: Date = clock.now()): Promise<number> {
  const { count } = await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86400_000) } } });
  return count;
}
