import { afterEach, describe, expect, test } from '@jest/globals';

import {
  defaultRegion,
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
  // Restore the variables on the same process.env object: Expo's Babel preset
  // makes region.ts read that exact object, so replacing it would have no effect.
  const names = [
    'EXPO_PUBLIC_SUPABASE_US_URL',
    'EXPO_PUBLIC_SUPABASE_US_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_SUPABASE_CN_URL',
    'EXPO_PUBLIC_SUPABASE_CN_PUBLISHABLE_KEY',
  ];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  afterEach(() => {
    for (const name of names) {
      if (saved[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = saved[name];
      }
    }
  });

  test('a region is available only when its URL and key are both set', () => {
    process.env.EXPO_PUBLIC_SUPABASE_CN_URL = 'https://cn.example.com';
    delete process.env.EXPO_PUBLIC_SUPABASE_CN_PUBLISHABLE_KEY;
    expect(isRegionAvailable('cn')).toBe(false);

    process.env.EXPO_PUBLIC_SUPABASE_CN_PUBLISHABLE_KEY = 'key';
    expect(isRegionAvailable('cn')).toBe(true);
  });

  test('new families go to the US server when it is configured, else China', () => {
    process.env.EXPO_PUBLIC_SUPABASE_US_URL = 'https://us.example.com';
    process.env.EXPO_PUBLIC_SUPABASE_US_PUBLISHABLE_KEY = 'key';
    expect(defaultRegion()).toBe('us');

    delete process.env.EXPO_PUBLIC_SUPABASE_US_URL;
    process.env.EXPO_PUBLIC_SUPABASE_CN_URL = 'https://cn.example.com';
    process.env.EXPO_PUBLIC_SUPABASE_CN_PUBLISHABLE_KEY = 'key';
    expect(defaultRegion()).toBe('cn');

    delete process.env.EXPO_PUBLIC_SUPABASE_CN_URL;
    expect(defaultRegion()).toBeNull();
  });

  test('the chosen region is remembered', async () => {
    expect(await loadSavedRegion()).toBeNull();
    await saveRegion('cn');
    expect(await loadSavedRegion()).toBe('cn');
  });
});
