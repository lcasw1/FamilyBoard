import { describe, expect, test } from '@jest/globals';

import en from '../../i18n/en.json';
import zhCN from '../../i18n/zh-CN.json';
import { ApiError, toApiError, unwrap, type ErrorKey } from '../errors';

describe('toApiError', () => {
  test('keeps the short keys our database functions raise', () => {
    expect(toApiError({ message: 'invite_expired' }).key).toBe('invite_expired');
  });

  test('recognises network failures', () => {
    expect(toApiError(new TypeError('Network request failed')).key).toBe('network');
  });

  test('anything else becomes generic, without copying the message', () => {
    const error = toApiError({ message: 'duplicate key value violates "secret caption"' });
    expect(error.key).toBe('generic');
    expect(error.message).toBe('generic');
  });
});

describe('unwrap', () => {
  test('returns data when there is no error', () => {
    expect(unwrap({ data: 42, error: null })).toBe(42);
  });

  test('throws an ApiError when there is one', () => {
    expect(() => unwrap({ data: null, error: { message: 'invite_used' } })).toThrow(ApiError);
  });
});

test('every error key has text in both languages', () => {
  // Keep in sync with KNOWN_ERRORS in errors.ts.
  const keys: ErrorKey[] = [
    'generic',
    'network',
    'not_allowed',
    'invalid_display_name',
    'invalid_expiry',
    'invite_not_found',
    'invite_used',
    'invite_expired',
    'invite_role_not_allowed',
    'already_member',
    'invalid_email_code',
    'region_unavailable',
  ];
  for (const key of keys) {
    expect(en.errors).toHaveProperty(key);
    expect(zhCN.errors).toHaveProperty(key);
  }
  expect(Object.keys(zhCN.errors).sort()).toEqual(Object.keys(en.errors).sort());
});
