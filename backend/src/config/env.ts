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
  // 앞단 프록시 홉 수. Render는 프록시 1단 → 1. 프록시 없이 직접 노출하면 0
  TRUST_PROXY_HOPS: parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10),

  // ── 키워드 도구 (서버 전용 비밀값) ──
  // 약관 확인 전까지 기본값은 mock. naver로 바꾸면 아래 세 값이 모두 필요
  KEYWORD_TOOL_PROVIDER: (process.env.KEYWORD_TOOL_PROVIDER === 'naver' ? 'naver' : 'mock') as 'naver' | 'mock',
  NAVER_SEARCHAD_API_KEY: process.env.NAVER_SEARCHAD_API_KEY ?? '',
  NAVER_SEARCHAD_SECRET_KEY: process.env.NAVER_SEARCHAD_SECRET_KEY ?? '',
  NAVER_SEARCHAD_CUSTOMER_ID: process.env.NAVER_SEARCHAD_CUSTOMER_ID ?? '',

  // ── 추적 링크 · 클릭 집계 ──
  // 추적 링크 도메인. 정식 도메인 구매 후 이 값만 바꾸면 된다 (이미 발급된 글 속 링크는 바뀌지 않음)
  TRACKING_BASE_URL: (process.env.TRACKING_BASE_URL ?? 'https://mombridge.vercel.app').replace(/\/+$/, ''),
  // 방문자 해시용 서버 비밀값(32자 이상). 없으면 클릭 기록을 끄고 리다이렉트만 한다
  CLICK_HASH_SECRET: process.env.CLICK_HASH_SECRET ?? '',
  // 프론트(Vercel) 프록시가 실제 방문자 IP·UA를 넘길 때 쓰는 공유 비밀값
  TRACKING_PROXY_SECRET: process.env.TRACKING_PROXY_SECRET ?? '',
  // 일 배치 엔드포인트 호출 토큰. 없으면 배치 엔드포인트 비활성
  INTERNAL_JOB_TOKEN: process.env.INTERNAL_JOB_TOKEN ?? '',
  FRONTEND_URL: (process.env.FRONTEND_URL ?? 'https://mombridge.vercel.app').replace(/\/+$/, ''),
};

if (env.KEYWORD_TOOL_PROVIDER === 'naver') {
  for (const key of ['NAVER_SEARCHAD_API_KEY', 'NAVER_SEARCHAD_SECRET_KEY', 'NAVER_SEARCHAD_CUSTOMER_ID'] as const) {
    if (!env[key]) { console.error(`Missing required env var for KEYWORD_TOOL_PROVIDER=naver: ${key}`); process.exit(1); }
  }
}
if (env.CLICK_HASH_SECRET && env.CLICK_HASH_SECRET.length < 32) {
  console.error('CLICK_HASH_SECRET must be at least 32 characters'); process.exit(1);
}

export const isDev = () => env.NODE_ENV === 'development';
export const isProd = () => env.NODE_ENV === 'production';
