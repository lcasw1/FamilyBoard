// Runs before every test file. AsyncStorage is native code, so tests use an
// in-memory stand-in provided by the library.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
