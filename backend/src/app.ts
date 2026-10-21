import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
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

app.get('/health', (_req, res) => res.json({ status: 'ok', env: env.NODE_ENV }));

// 추적 링크 리다이렉트 (프론트 /r/:code 가 이 경로로 프록시)
app.use('/r', redirectRoutes);

app.use('/api/v1', routes);

app.use(errorHandler);

export default app;
