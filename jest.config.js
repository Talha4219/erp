/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(next-auth|@auth|jose)/)',
  ],
  testTimeout: 10000,
  globalSetup: './tests/setup/global-setup.ts',
  globalTeardown: './tests/setup/global-teardown.ts',
}

module.exports = config
