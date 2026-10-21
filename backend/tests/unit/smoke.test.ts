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
