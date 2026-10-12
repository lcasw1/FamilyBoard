// Which Supabase server to talk to. A family lives in one region ('us' or 'cn');
// each region is a separate server with its own URL and key.
//
// The device remembers its current region in AsyncStorage (a small key-value store
// on the phone, like a dict saved to disk). New users learn their region from the
// first two letters of their invite code.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Region = 'us' | 'cn';

export type RegionConfig = {
  url: string;
  publishableKey: string;
};

const SAVED_REGION_KEY = 'familyboard.region';

// Expo copies EXPO_PUBLIC_* variables into the app when it is built, and it only
// recognises them written out in full like this (not process.env[someName]).
function configFromEnv(): Record<Region, RegionConfig | null> {
  return {
    us: makeConfig(
      process.env.EXPO_PUBLIC_SUPABASE_US_URL,
      process.env.EXPO_PUBLIC_SUPABASE_US_PUBLISHABLE_KEY,
    ),
    cn: makeConfig(
      process.env.EXPO_PUBLIC_SUPABASE_CN_URL,
      process.env.EXPO_PUBLIC_SUPABASE_CN_PUBLISHABLE_KEY,
    ),
  };
}

function makeConfig(url?: string, publishableKey?: string): RegionConfig | null {
  return url && publishableKey ? { url, publishableKey } : null;
}

export function isRegion(value: unknown): value is Region {
  return value === 'us' || value === 'cn';
}

/** True if this build of the app has a server configured for the region. */
export function isRegionAvailable(region: Region): boolean {
  return configFromEnv()[region] !== null;
}

/**
 * The server for someone starting a new family (no invite code to go by).
 * The US server for now; once the China server exists, the app will ask.
 */
export function defaultRegion(): Region | null {
  if (isRegionAvailable('us')) return 'us';
  if (isRegionAvailable('cn')) return 'cn';
  return null;
}

export function regionConfig(region: Region): RegionConfig {
  const config = configFromEnv()[region];
  if (!config) {
    throw new Error(`No Supabase server configured for region "${region}"`);
  }
  return config;
}

/**
 * Removes spaces and dashes and upper-cases an invite code, matching how the server
 * stores it: ' us-7k3q xm ' -> 'US7K3QXM'.
 */
export function normalizeInviteCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** Formats a stored code for people to read: 'US7K3QXM' -> 'US-7K3QXM'. */
export function formatInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
}

/** The region an invite code belongs to, or null if the code doesn't start with one. */
export function regionFromInviteCode(code: string): Region | null {
  const prefix = normalizeInviteCode(code).slice(0, 2).toLowerCase();
  return isRegion(prefix) ? prefix : null;
}

export async function loadSavedRegion(): Promise<Region | null> {
  const saved = await AsyncStorage.getItem(SAVED_REGION_KEY);
  return isRegion(saved) ? saved : null;
}

export async function saveRegion(region: Region): Promise<void> {
  await AsyncStorage.setItem(SAVED_REGION_KEY, region);
}
