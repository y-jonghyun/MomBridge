import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';

describeDb('로그인·가입 시도 제한', () => {
  beforeAll(async () => {
    await resetDb();
    await prisma.user.create({
      data: { email: 'mom@test.local', passwordHash: await bcrypt.hash('right-pass', 4), name: '맘', role: 'PARTICIPANT' },
    });
  });
  afterAll(() => prisma.$disconnect());

  const login = (email: string, password: string, ip = '203.0.113.10') =>
    request(app).post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email, password });

  it('blocks the 6th failed login for the same email from the same IP, with the same message for unknown emails', async () => {
    for (let i = 0; i < 5; i++) expect((await login('mom@test.local', 'wrong')).status).toBe(401);
    const blocked = await login('MOM@test.local ', 'wrong');
    expect(blocked.status).toBe(429);

    for (let i = 0; i < 5; i++) expect((await login('nobody@test.local', 'wrong')).status).toBe(401);
    const blockedUnknown = await login('nobody@test.local', 'wrong');
    expect(blockedUnknown.status).toBe(429);
    expect(blockedUnknown.body).toEqual(blocked.body);
    expect(blocked.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('keeps other IPs and successful logins unaffected', async () => {
    expect((await login('mom@test.local', 'right-pass', '198.51.100.7')).status).toBe(200);
    // 성공한 로그인은 횟수에 들어가지 않는다
    for (let i = 0; i < 8; i++) expect((await login('mom@test.local', 'right-pass', '198.51.100.8')).status).toBe(200);
  });

  it('limits failed logins across many emails from one IP', async () => {
    const ip = '192.0.2.50';
    for (let i = 0; i < 30; i++) expect((await login(`u${i}@test.local`, 'wrong', ip)).status).toBe(401);
    expect((await login('u99@test.local', 'wrong', ip)).status).toBe(429);
  });

  it('limits registrations per IP', async () => {
    const ip = '192.0.2.77';
    const reg = (i: number) => request(app).post('/api/v1/auth/register').set('X-Forwarded-For', ip)
      .send({ email: `r${i}@test.local`, password: 'pass1234', name: '가입', role: 'PARTICIPANT' });
    for (let i = 0; i < 20; i++) expect((await reg(i)).status).toBe(201);
    expect((await reg(20)).status).toBe(429);
  });
});
