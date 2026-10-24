import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { clock } from '../../src/lib/clock';
import { mailer, Mail } from '../../src/utils/mailer';
import { deleteExpiredResetTokens } from '../../src/modules/auth/password-reset';

const api = request(app);
const requestReset = (email: string, ip = '203.0.113.1') =>
  api.post('/api/v1/auth/password-reset/request').set('X-Forwarded-For', ip).send({ email });
const confirm = (token: string, newPassword = 'brandnew1', ip = '203.0.113.1') =>
  api.post('/api/v1/auth/password-reset/confirm').set('X-Forwarded-For', ip).send({ token, newPassword });
const login = (email: string, password: string) => api.post('/api/v1/auth/login').send({ email, password });

/**
 * 재설정 요청은 가입 여부를 숨기려고 응답을 먼저 보내고 토큰 기록·메일 발송을 뒤에서 한다.
 * 그래서 "응답이 왔다"는 아직 아무것도 기록되지 않았다는 뜻일 수 있다 — 조건이 참이 될 때까지 기다린다.
 */
async function waitFor(what: string, ready: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await ready()) return;
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error(`${what}을 5초 동안 기다렸지만 끝나지 않았다`);
}

/** 메일은 응답과 별개로 보내므로 발송될 때까지 기다린다 */
async function waitForMails(sent: Mail[], n: number) {
  await waitFor(`메일 ${n}통`, () => sent.length >= n);
  return sent;
}

/** 토큰 기록도 응답과 별개다 (메일 발송보다 먼저 끝난다) */
async function waitForResetTokens(n: number) {
  await waitFor(`재설정 토큰 ${n}개`, async () => (await prisma.passwordResetToken.count()) >= n);
}
const tokenFrom = (mail: Mail) => new URL(mail.text.match(/https?:\/\/\S+/)![0]).searchParams.get('token')!;

describeDb('비밀번호 재설정', () => {
  let sent: Mail[];
  let ipSeq = 0;
  const ip = () => `198.51.100.${++ipSeq}`;

  beforeEach(async () => {
    await resetDb();
    sent = [];
    process.env.RESEND_API_KEY = 'test-key';
    process.env.MAIL_FROM = 'MomBridge <no-reply@test.example>';
    jest.spyOn(mailer, 'send').mockImplementation(async mail => { sent.push(mail); });
    await prisma.user.create({ data: { email: 'mom@example.com', passwordHash: await bcrypt.hash('old-pass-1', 4), name: '<맘>', role: 'PARTICIPANT' } });
  });
  afterEach(() => { jest.restoreAllMocks(); clock.set(null); delete process.env.RESEND_API_KEY; delete process.env.MAIL_FROM; });
  afterAll(() => prisma.$disconnect());

  it('mails a one-time link that sets a new password and logs out every session', async () => {
    const before = await login('mom@example.com', 'old-pass-1');
    const res = await requestReset('MOM@example.com', ip());
    expect(res.status).toBe(200);
    const [mail] = await waitForMails(sent, 1);
    expect(mail.to).toBe('mom@example.com');
    expect(mail.text).toContain('https://app.test.example/reset-password?token=');
    expect(mail.html).toContain('&lt;맘&gt;님');

    const token = tokenFrom(mail);
    // DB에는 원문이 아니라 해시만
    const stored = await prisma.passwordResetToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    expect((await confirm(token, 'brandnew1', ip())).status).toBe(200);
    expect((await login('mom@example.com', 'old-pass-1')).status).toBe(401);
    expect((await login('mom@example.com', 'brandnew1')).status).toBe(200);
    // 기존 세션의 리프레시 토큰은 무효
    expect((await api.post('/api/v1/auth/refresh').send({ refreshToken: before.body.data.refreshToken })).status).toBe(401);
    // 같은 링크는 다시 못 씀
    expect((await confirm(token, 'another-pass', ip())).status).toBe(400);
  });

  it('answers the same for unknown or deactivated accounts and sends nothing', async () => {
    const known = await requestReset('mom@example.com', ip());
    const unknown = await requestReset('nobody@example.com', ip());
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    // 보내져야 하는 1통이 도착한 뒤에 센다 — 느린 러너에서 아직 안 왔을 뿐인 걸 "안 보냄"으로 읽지 않게
    await waitForMails(sent, 1);
    await prisma.user.update({ where: { email: 'mom@example.com' }, data: { isActive: false } });
    await requestReset('mom@example.com', ip());
    // 보내지지 않아야 하는 메일은 기다릴 수 없으니, 나갈 시간을 준 뒤 그대로인지 본다
    await new Promise(r => setTimeout(r, 300));
    expect(sent.map(m => m.to)).toEqual(['mom@example.com']);
  });

  it('expires links after 30 minutes and keeps only the newest one', async () => {
    const t0 = new Date('2026-10-22T10:00:00+09:00');
    clock.set(() => t0);
    await requestReset('mom@example.com', ip());
    // 첫 토큰이 기록되기 전에 두 번째 요청이 시작되면, 두 요청의 "기존 토큰 삭제"가 모두
    // 생성보다 먼저 일어나 토큰이 2개 남는다. 순서를 확정한 뒤에 두 번째를 보낸다
    await waitForResetTokens(1);
    await requestReset('mom@example.com', ip());
    const [first, second] = (await waitForMails(sent, 2)).map(tokenFrom);
    expect(await prisma.passwordResetToken.count()).toBe(1);
    expect((await confirm(first, 'brandnew1', ip())).status).toBe(400);

    clock.set(() => new Date(t0.getTime() + 31 * 60_000));
    expect((await confirm(second, 'brandnew1', ip())).status).toBe(400);
    expect((await login('mom@example.com', 'old-pass-1')).status).toBe(200);

    clock.set(() => new Date(t0.getTime() + 2 * 86400_000));
    expect(await deleteExpiredResetTokens()).toBe(1);
  });

  it('says the feature is unavailable when mail is not configured, and validates input', async () => {
    delete process.env.RESEND_API_KEY;
    const res = await requestReset('mom@example.com', ip());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('RESET_UNAVAILABLE');
    expect((await api.post('/api/v1/auth/password-reset/request').send({ email: 'nope' })).status).toBe(400);
    expect((await confirm('x'.repeat(43), '123', ip())).status).toBe(400);
  });

  it('rate-limits reset requests per IP', async () => {
    const same = ip();
    for (let i = 0; i < 5; i++) expect((await requestReset(`u${i}@example.com`, same)).status).toBe(200);
    expect((await requestReset('u9@example.com', same)).status).toBe(429);
  });
});
