import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createOperator } from '../../src/scripts/create-operator';

describeDb('회원가입 역할 제한 · 운영자 생성 스크립트', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  const body = (role: string) => ({ email: `${role.toLowerCase()}@test.local`, password: 'pass1234', name: '테스트', role });

  it('refuses to register an OPERATOR (or any unknown role)', async () => {
    for (const role of ['OPERATOR', 'operator', 'ADMIN']) {
      const res = await request(app).post('/api/v1/auth/register').send(body(role));
      expect(res.status).toBe(400);
    }
    expect(await prisma.user.count()).toBe(0);
  });

  it('still registers participants and clients', async () => {
    for (const role of ['PARTICIPANT', 'CLIENT']) {
      const res = await request(app).post('/api/v1/auth/register').send(body(role));
      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe(role);
    }
  });

  it('validates the rest of the body', async () => {
    expect((await request(app).post('/api/v1/auth/register').send({ ...body('CLIENT'), email: 'nope' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/register').send({ ...body('CLIENT'), password: '123' })).status).toBe(400);
  });

  it('createOperator makes an operator with a profile and a hashed password, and refuses duplicates', async () => {
    const user = await createOperator({ email: 'ops@test.local', name: '운영자', password: 'long-enough-pw' });
    expect(user.role).toBe('OPERATOR');
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { operatorProfile: true } });
    expect(stored.operatorProfile).not.toBeNull();
    expect(stored.passwordHash).not.toContain('long-enough-pw');
    expect(await bcrypt.compare('long-enough-pw', stored.passwordHash)).toBe(true);
    await expect(createOperator({ email: 'ops@test.local', name: 'x', password: 'long-enough-pw' })).rejects.toThrow('이미 있는');
    await expect(createOperator({ email: 'b@test.local', name: 'x', password: 'short' })).rejects.toThrow('10자');

    const login = await request(app).post('/api/v1/auth/login').send({ email: 'ops@test.local', password: 'long-enough-pw' });
    expect(login.body.data.user.role).toBe('OPERATOR');
  });
});
