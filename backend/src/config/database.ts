import { PrismaClient } from '@prisma/client';
import { isDev } from './env';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ?? new PrismaClient({ log: isDev() ? ['warn', 'error'] : ['error'] });

if (isDev()) global.__prisma = prisma;

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
