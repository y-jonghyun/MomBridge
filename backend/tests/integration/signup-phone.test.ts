import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createOperator, createParticipant, nextPhone } from '../helpers/factory';

/**
 * 가입 필수 항목이 된 휴대폰 번호 — 형식·중복·노출 범위를 지킨다.
 */
describeDb('가입 휴대폰 번호', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  let seq = 0;
  const register = (phone: unknown, role = 'PARTICIPANT') =>
    request(app).post('/api/v1/auth/register')
      .send({ email: `p${seq++}-${Date.now()}@test.local`, password: 'pass1234', name: '맘', role, phone });

  it('010으로 시작하는 11자리만 받고, 하이픈은 떼어 숫자만 저장한다', async () => {
    const ok = await register('010-1234-5678');
    expect(ok.status).toBe(201);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: ok.body.data.user.id } });
    expect(saved.phone).toBe('01012345678');
    // 번호는 가입 응답에 담지 않는다
    expect(JSON.stringify(ok.body.data.user)).not.toContain('1234');

    for (const bad of ['', '0212345678', '01112345678', '010123456', '0101234567890', 'abcdefghijk', '010-1234-567a', null, undefined, 12345678901]) {
      const res = await register(bad);
      expect(res.status).toBe(400);
    }
    expect(await prisma.user.count()).toBe(1);
  });

  it('이미 가입된 번호는 하이픈을 달리 써도 거절한다', async () => {
    expect((await register('01099998888')).status).toBe(201);

    const again = await register('010-9999-8888', 'CLIENT');
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('PHONE_EXISTS');
    expect(again.body.error.message).toBe('이미 가입된 번호예요');
    expect(await prisma.user.count()).toBe(1);
  });

  it('번호 중복 응답도 가입 횟수 제한(registerPerIp)을 그대로 받는다', async () => {
    // 같은 번호로 계속 두드려 다른 사람의 가입 여부를 캐내지 못하게, 실패해도 횟수를 센다
    const ip = '192.0.2.123';
    const probe = () => request(app).post('/api/v1/auth/register').set('X-Forwarded-For', ip)
      .send({ email: `dup${seq++}@test.local`, password: 'pass1234', name: '맘', role: 'PARTICIPANT', phone: '01077776666' });

    expect((await probe()).status).toBe(201);
    for (let i = 0; i < 19; i++) expect((await probe()).status).toBe(409);
    expect((await probe()).status).toBe(429); // 20회(registerPerIp)를 넘기면 더는 답하지 않는다
  }, 60_000);

  it('내 번호는 내가 바꿀 수 있고, 남이 쓰는 번호로는 못 바꾼다', async () => {
    const mine = await register('01011112222');
    const token = mine.body.data.accessToken;
    const other = await createParticipant();
    const taken = other.user.phone!;

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.data.user.phone).toBe('01011112222');
    expect(me.body.data.user.phoneVerifiedAt).toBeNull(); // 문자 인증 자리는 비어 있다

    const bad = await request(app).patch('/api/v1/auth/me/phone')
      .set('Authorization', `Bearer ${token}`).send({ phone: taken });
    expect(bad.status).toBe(409);

    const ok = await request(app).patch('/api/v1/auth/me/phone')
      .set('Authorization', `Bearer ${token}`).send({ phone: '010-3333-4444' });
    expect(ok.status).toBe(200);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: mine.body.data.user.id } });
    expect(saved.phone).toBe('01033334444');
  });

  it('운영자 회원 목록은 가운데 네 자리를 가리고, 상세에서만 전체를 준다', async () => {
    const operator = await createOperator();
    const member = await createParticipant();
    await prisma.user.update({ where: { id: member.user.id }, data: { phone: '01052223333' } });

    const list = await request(app).get('/api/v1/operator/users?role=PARTICIPANT')
      .set('Authorization', `Bearer ${operator.token}`);
    expect(list.status).toBe(200);
    const row = list.body.data.find((u: { id: string }) => u.id === member.user.id);
    expect(row.phone).toBe('010-****-3333');
    expect(JSON.stringify(list.body)).not.toContain('5222');

    const detail = await request(app).get(`/api/v1/operator/users/${member.user.id}`)
      .set('Authorization', `Bearer ${operator.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.phone).toBe('010-5222-3333');

    // 체험단원이 남의 상세를 볼 수는 없다
    const sneak = await request(app).get(`/api/v1/operator/users/${member.user.id}`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(sneak.status).toBe(403);
  });

  it('번호 없는 계정(스크립트로 만든 운영자)은 여럿이어도 유일 제약에 걸리지 않는다', async () => {
    await prisma.user.create({ data: { email: 'ops1@test.local', passwordHash: 'x', role: 'OPERATOR', name: 'a' } });
    await prisma.user.create({ data: { email: 'ops2@test.local', passwordHash: 'x', role: 'OPERATOR', name: 'b' } });
    expect(await prisma.user.count({ where: { phone: null } })).toBe(2);
    void nextPhone;
  });
});
