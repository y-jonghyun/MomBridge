// 모니터링은 다른 모듈보다 먼저 초기화한다 (Sentry가 http·express를 계측하려면 먼저 로드돼야 함)
import './instrument';
import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';
import { captureError, flushMonitoring } from './lib/monitoring';

async function main() {
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(async (err) => {
  console.error('Server startup failed:', err);
  captureError(err, { area: 'api', extra: { stage: 'startup' } });
  await flushMonitoring();
  process.exit(1);
});
