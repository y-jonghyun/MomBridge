import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { prisma } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import redirectRoutes from './modules/tracking/redirect.routes';

const app = express();

// 프록시 뒤에서 req.ip가 실제 클라이언트 IP가 되도록 신뢰할 홉 수를 지정
app.set('trust proxy', env.TRUST_PROXY_HOPS);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 살아 있는지만 본다 (keep-alive 핑용 — DB가 잠시 느려도 서버를 깨우는 데는 지장 없게 DB를 보지 않음)
app.get('/health', (_req, res) => res.json({ status: 'ok', env: env.NODE_ENV }));

// 요청을 처리할 수 있는지: DB까지 확인. 모니터링·배포 확인용
const READY_TIMEOUT_MS = 3_000;
app.get('/health/ready', async (_req, res) => {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), READY_TIMEOUT_MS); }),
    ]);
    res.json({ status: 'ok', db: 'ok', dbMs: Date.now() - started });
  } catch (err) {
    res.status(503).json({ status: 'error', db: err instanceof Error && err.message === 'timeout' ? 'timeout' : 'unreachable' });
  } finally {
    clearTimeout(timer);
  }
});

// 추적 링크 리다이렉트 (프론트 /r/:code 가 이 경로로 프록시)
app.use('/r', redirectRoutes);

app.use('/api/v1', routes);

app.use(errorHandler);

export default app;
