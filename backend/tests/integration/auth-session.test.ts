import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createOperator } from '../../src/scripts/create-operator';

const api = request(app);
const register = (email: string, role = 'PARTICIPANT') =>
  api.post('/api/v1/auth/register').send({ email, password: 'pass1234', name: '맘', role });
const refresh = (refreshToken: string) => api.post('/api/v1/auth/refresh').send({ refreshToken });

describeDb('세션 · 이메일 정규화', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('stores emails in lowercase and treats case variants as the same account', async () => {
    const res = await register('  Mom.Kim@Example.COM ');
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('mom.kim@example.com');
    expect(res.body.data.user.tokenVersion).toBeUndefined();
    expect((await register('mom.kim@example.com')).status).toBe(409);
    expect((await register('MOM.KIM@EXAMPLE.COM', 'CLIENT')).status).toBe(409);
    expect((await api.post('/api/v1/auth/login').send({ email: 'MOM.kim@example.com', password: 'pass1234' })).status).toBe(200);
  });

  it('still finds accounts created with mixed case before normalization', async () => {
    await prisma.user.create({ data: { email: 'Legacy@Example.com', passwordHash: await bcrypt.hash('pass1234', 4), name: '기존', role: 'CLIENT' } });
    expect((await api.post('/api/v1/auth/login').send({ email: 'legacy@example.com', password: 'pass1234' })).status).toBe(200);
    expect((await register('LEGACY@example.com')).status).toBe(409);
    await expect(createOperator({ email: 'legacy@EXAMPLE.com', name: 'x', password: 'long-enough-pw' })).rejects.toThrow('이미 있는');
  });

  it('creates the user and its profile together', async () => {
    await register('p@example.com');
    await register('c@example.com', 'CLIENT');
    const users = await prisma.user.findMany({ include: { participantProfile: true, clientProfile: true }, orderBy: { email: 'asc' } });
    expect(users.map(u => [u.email, !!u.participantProfile, !!u.clientProfile])).toEqual([
      ['c@example.com', false, true], ['p@example.com', true, false],
    ]);
  });

  it('refreshes only while the account is active and the token version matches', async () => {
    const { body } = await register('s@example.com');
    const first = await refresh(body.data.refreshToken);
    expect(first.status).toBe(200);
    expect(first.body.data.accessToken).toBeTruthy();

    // 비밀번호 변경 → 기존 리프레시 토큰 무효, 응답으로 받은 새 토큰은 유효
    const changed = await api.patch('/api/v1/auth/me/password').set('Authorization', `Bearer ${body.data.accessToken}`)
      .send({ currentPassword: 'pass1234', newPassword: 'newpass5678' });
    expect(changed.status).toBe(200);
    expect((await refresh(body.data.refreshToken)).status).toBe(401);
    expect((await refresh(first.body.data.refreshToken)).status).toBe(401);
    const afterChange = await refresh(changed.body.data.refreshToken);
    expect(afterChange.status).toBe(200);

    // 운영자가 비활성화 → 재발급 불가, 다시 활성화해도 예전 토큰은 무효
    const { token: opToken } = await (async () => {
      const op = await createOperator({ email: 'op@example.com', name: '운영', password: 'long-enough-pw' });
      const login = await api.post('/api/v1/auth/login').send({ email: op.email, password: 'long-enough-pw' });
      return { token: login.body.data.accessToken as string };
    })();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 's@example.com' } });
    const setActive = (isActive: boolean) =>
      api.patch(`/api/v1/operator/users/${user.id}/active`).set('Authorization', `Bearer ${opToken}`).send({ isActive });
    expect((await setActive(false)).status).toBe(200);
    expect((await refresh(afterChange.body.data.refreshToken)).status).toBe(401);
    expect((await setActive(true)).status).toBe(200);
    expect((await refresh(afterChange.body.data.refreshToken)).status).toBe(401);
    expect((await api.post('/api/v1/auth/login').send({ email: 's@example.com', password: 'newpass5678' })).status).toBe(200);
  });

  it('accepts refresh tokens issued before token versions existed, and rejects deleted users and garbage', async () => {
    const { body } = await register('old@example.com');
    const id = body.data.user.id;
    const legacy = jwt.sign({ sub: id, email: 'old@example.com', role: 'PARTICIPANT' }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    expect((await refresh(legacy)).status).toBe(200);

    await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
    expect((await refresh(legacy)).status).toBe(401);
    expect((await refresh('not-a-token')).status).toBe(401);
    expect((await api.post('/api/v1/auth/refresh').send({})).status).toBe(401);
    expect((await api.post('/api/v1/auth/login').send({ email: 'old@example.com', password: 'pass1234' })).status).toBe(401);
  });
});
