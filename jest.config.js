// Unit tests: fast, no server needed. Run with `npm test`.
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.ts$'],
};
