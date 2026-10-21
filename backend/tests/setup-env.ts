// 테스트 전용 환경변수. 실제 비밀값은 절대 넣지 않는다.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://unused:unused@localhost:1/unused';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret';
