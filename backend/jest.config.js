/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  globalSetup: '<rootDir>/tests/global-setup.ts',
  // DB를 공유하는 통합 테스트가 있으므로 직렬 실행
  maxWorkers: 1,
};
