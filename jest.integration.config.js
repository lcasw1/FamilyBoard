// Integration tests: call src/api/ against the local Supabase.
// Run with `npm run db:start` first, then `npm run test:integration`.
//
// Unlike the unit tests, these don't use the jest-expo preset: it replaces the
// global fetch with a stand-in, so no request would reach the server. Plain Node
// is enough because jest.integration.setup.js stubs the few native modules used.
module.exports = {
  testEnvironment: 'node',
  transform: { '\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  // babel-preset-expo turns process.env.EXPO_PUBLIC_* into an import of this file.
  transformIgnorePatterns: ['/node_modules/(?!expo/virtual/)'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFiles: ['<rootDir>/jest.setup.js', '<rootDir>/jest.integration.setup.js'],
  testMatch: ['**/*.integration.test.ts'],
  testTimeout: 30000,
  // Node's fetch keeps idle connections open for a few seconds after the last
  // request; don't make Jest wait for them (it exits cleanly either way).
  forceExit: true,
};
