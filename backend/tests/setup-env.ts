// 테스트 전용 환경변수. 실제 비밀값은 절대 넣지 않는다.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://unused:unused@localhost:1/unused';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret';
process.env.CLICK_HASH_SECRET = 'test-click-hash-secret-0123456789abcdef';
process.env.TRACKING_PROXY_SECRET = 'test-proxy-secret';
process.env.INTERNAL_JOB_TOKEN = 'test-job-token';
process.env.TRACKING_BASE_URL = 'https://tracking.test.example';
process.env.FRONTEND_URL = 'https://app.test.example';
process.env.KEYWORD_TOOL_PROVIDER = 'mock';
// bcrypt 해시 비용은 테스트에서만 낮춘다 (운영 기본값은 env.ts의 12)
process.env.BCRYPT_ROUNDS = '4';
