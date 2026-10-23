import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/** 공개 주소(origin) 환경변수. 코드에 기본 도메인을 두지 않는다 — 비어 있으면 '' */
function originFromEnv(key: string): string {
  const raw = (process.env[key] ?? '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  let valid = false;
  try {
    const u = new URL(raw);
    valid = (u.protocol === 'https:' || u.protocol === 'http:') && u.pathname === '/' && !u.search && !u.hash;
  } catch { /* invalid */ }
  if (!valid) { console.error(`${key} must be an origin like https://example.com`); process.exit(1); }
  return raw;
}

function required(key: string): string {
  const val = process.env[key];
  if (!val) { console.error(`Missing required env var: ${key}`); process.exit(1); }
  return val;
}

/**
 * 비밀번호 해시 비용(bcrypt rounds). 운영 기본값은 12.
 * 테스트에서만 낮춰 쓴다 — 가입을 수십 번 반복하는 통합 테스트가 느려지지 않게.
 */
function bcryptRounds(): number {
  const raw = (process.env.BCRYPT_ROUNDS ?? '').trim();
  if (!raw) return 12;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 4 || n > 15) {
    console.error('BCRYPT_ROUNDS must be an integer between 4 and 15'); process.exit(1);
  }
  return n;
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
  // 비밀번호 해시 비용. 기본 12 — 운영에서는 12 미만으로 내릴 수 없다
  BCRYPT_ROUNDS: bcryptRounds(),

  // ── 키워드 도구 (서버 전용 비밀값) ──
  // 약관 확인 전까지 기본값은 mock. naver로 바꾸면 아래 세 값이 모두 필요
  KEYWORD_TOOL_PROVIDER: (process.env.KEYWORD_TOOL_PROVIDER === 'naver' ? 'naver' : 'mock') as 'naver' | 'mock',
  NAVER_SEARCHAD_API_KEY: process.env.NAVER_SEARCHAD_API_KEY ?? '',
  NAVER_SEARCHAD_SECRET_KEY: process.env.NAVER_SEARCHAD_SECRET_KEY ?? '',
  NAVER_SEARCHAD_CUSTOMER_ID: process.env.NAVER_SEARCHAD_CUSTOMER_ID ?? '',

  // ── 추적 링크 · 클릭 집계 ──
  // 추적 링크 도메인(프론트 주소). 환경변수로만 받는다 — 비어 있으면 체험단원에게 링크를 보여주지 않는다.
  // 정식 도메인 구매 후 이 값만 바꾸면 된다 (이미 글에 들어간 링크는 바뀌지 않으므로 오픈 전에 확정)
  TRACKING_BASE_URL: originFromEnv('TRACKING_BASE_URL'),
  // 방문자 해시용 서버 비밀값(32자 이상). 없으면 클릭 기록을 끄고 리다이렉트만 한다
  CLICK_HASH_SECRET: process.env.CLICK_HASH_SECRET ?? '',
  // 프론트(Vercel) 프록시가 실제 방문자 IP·UA를 넘길 때 쓰는 공유 비밀값
  TRACKING_PROXY_SECRET: process.env.TRACKING_PROXY_SECRET ?? '',
  // 일 배치 엔드포인트 호출 토큰. 없으면 배치 엔드포인트 비활성
  INTERNAL_JOB_TOKEN: process.env.INTERNAL_JOB_TOKEN ?? '',
  // 리포트 공유 링크에 쓰는 프론트 주소. 환경변수로만 받는다
  FRONTEND_URL: originFromEnv('FRONTEND_URL'),

  // ── 미션 사진 저장소 (Supabase Storage 공개 버킷) ──
  // 서비스 키는 서버 전용. 비어 있으면 사진 업로드만 꺼지고 나머지 기능은 그대로 동작한다
  SUPABASE_URL: (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, ''),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'mission-images',
};

if (env.KEYWORD_TOOL_PROVIDER === 'naver') {
  for (const key of ['NAVER_SEARCHAD_API_KEY', 'NAVER_SEARCHAD_SECRET_KEY', 'NAVER_SEARCHAD_CUSTOMER_ID'] as const) {
    if (!env[key]) { console.error(`Missing required env var for KEYWORD_TOOL_PROVIDER=naver: ${key}`); process.exit(1); }
  }
}
if (env.CLICK_HASH_SECRET && env.CLICK_HASH_SECRET.length < 32) {
  console.error('CLICK_HASH_SECRET must be at least 32 characters'); process.exit(1);
}
if (env.NODE_ENV === 'production' && env.BCRYPT_ROUNDS < 12) {
  console.error('BCRYPT_ROUNDS must be at least 12 in production'); process.exit(1);
}

export const isDev = () => env.NODE_ENV === 'development';
export const isProd = () => env.NODE_ENV === 'production';
