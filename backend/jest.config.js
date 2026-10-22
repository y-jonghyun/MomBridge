/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  globalSetup: '<rootDir>/tests/global-setup.ts',
  // DB를 공유하는 통합 테스트가 있으므로 직렬 실행
  maxWorkers: 1,
  // 통합 테스트는 가입·해시·DB 왕복이 섞여 기본 5초로는 느린 CI 러너에서 아슬아슬하다
  testTimeout: 15_000,
};
