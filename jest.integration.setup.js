// Points the app at the local Supabase and replaces native-only modules with
// Node equivalents, so src/api/ can run outside a phone.
const { execSync } = require('node:child_process');

const status = execSync('npx supabase status -o env', { encoding: 'utf8' });
const env = Object.fromEntries(
  status
    .split('\n')
    .map((line) => /^([A-Z_]+)="(.*)"$/.exec(line))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
process.env.EXPO_PUBLIC_SUPABASE_US_URL = env.API_URL;
process.env.EXPO_PUBLIC_SUPABASE_US_PUBLISHABLE_KEY = env.PUBLISHABLE_KEY;
// Only the tests use the secret key (to create users without sending email).
process.env.TEST_SUPABASE_SECRET_KEY = env.SECRET_KEY;
process.env.TEST_MAILPIT_URL = env.MAILPIT_URL;

jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('expo-file-system', () => ({}));
// The real react-native module swaps Node's fetch for a mocked one in tests, which
// would stop requests reaching the local server. src/api/ only needs these two.
jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
  Platform: { OS: 'android' },
}));
