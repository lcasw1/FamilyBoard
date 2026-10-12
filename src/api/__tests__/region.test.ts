import { afterEach, describe, expect, test } from '@jest/globals';

import {
  formatInviteCode,
  isRegionAvailable,
  loadSavedRegion,
  normalizeInviteCode,
  regionFromInviteCode,
  saveRegion,
} from '../region';

describe('invite codes', () => {
  test('normalize strips spaces and dashes and upper-cases', () => {
    expect(normalizeInviteCode(' us-7k3q xm ')).toBe('US7K3QXM');
  });

  test('format adds a dash after the region', () => {
    expect(formatInviteCode('US7K3QXM')).toBe('US-7K3QXM');
  });

  test('region comes from the first two letters', () => {
    expect(regionFromInviteCode('US7K3QXM')).toBe('us');
    expect(regionFromInviteCode('cn-abc234')).toBe('cn');
    expect(regionFromInviteCode('XX7K3QXM')).toBeNull();
    expect(regionFromInviteCode('')).toBeNull();
  });
});

describe('region config', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  test('a region is available only when its URL and key are both set', () => {
    process.env.EXPO_PUBLIC_SUPABASE_CN_URL = 'https://cn.example.com';
    delete process.env.EXPO_PUBLIC_SUPABASE_CN_PUBLISHABLE_KEY;
    expect(isRegionAvailable('cn')).toBe(false);

    process.env.EXPO_PUBLIC_SUPABASE_CN_PUBLISHABLE_KEY = 'key';
    expect(isRegionAvailable('cn')).toBe(true);
  });

  test('the chosen region is remembered', async () => {
    expect(await loadSavedRegion()).toBeNull();
    await saveRegion('cn');
    expect(await loadSavedRegion()).toBe('cn');
  });
});
