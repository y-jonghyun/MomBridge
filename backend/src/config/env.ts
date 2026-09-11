import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) { console.error(`Missing required env var: ${key}`); process.exit(1); }
  return val;
}

export const env = {
  NODE_ENV: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
  PORT: parseInt(process.env.PORT ?? '4000', 10),
  DATABASE_URL: required('DATABASE_URL'),
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map(s => s.trim()),
};

export const isDev = () => env.NODE_ENV === 'development';
export const isProd = () => env.NODE_ENV === 'production';
