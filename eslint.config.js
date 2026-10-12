// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // CLAUDE.md: all network calls live in src/api/. Screens and components use
    // the functions exported from src/api/ and never talk to Supabase directly.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*', '**/api/client'],
              message: 'Use the functions in src/api/ instead.',
            },
          ],
        },
      ],
    },
  },
]);
