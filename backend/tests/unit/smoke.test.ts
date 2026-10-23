import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';

describe('health', () => {
  it('responds ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('health/ready', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports ok when the database answers', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }] as never);
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
  });

  it('returns 503 without leaking error details when the database is down', async () => {
    jest.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error("Can't reach database server at db.secret-host:5432") as never);
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', db: 'unreachable' });
    // keep-alive용 /health는 DB와 상관없이 200
    expect((await request(app).get('/health')).status).toBe(200);
  });
});

describe('request body', () => {
  it('rejects bodies over 100kb with 413 and broken JSON with 400', async () => {
    const big = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.c', password: 'x'.repeat(110_000) });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    const broken = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(broken.status).toBe(400);
    expect(broken.body.error.code).toBe('INVALID_JSON');
  });

  it('accepts a long but normal body (10,000 Korean characters)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'bad', password: 'pass1234', name: '가'.repeat(10_000), role: 'CLIENT' });
    expect(res.status).toBe(400); // 본문 크기는 통과하고 입력 검증에서 걸린다
    expect(res.body.error.code).not.toBe('PAYLOAD_TOO_LARGE');
  });
});
