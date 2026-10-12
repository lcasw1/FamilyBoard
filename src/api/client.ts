// The one place that creates Supabase clients. Other files in src/api/ call
// `supabase()` to get the client for the current region; screens never import this.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';
import { loadSavedRegion, regionConfig, saveRegion, type Region } from './region';

// `SupabaseClient<Database>` gives typed queries: TypeScript knows every table's
// columns because database.types.ts is generated from our migrations.
type Client = SupabaseClient<Database>;

// One client per region, created on first use (like a dict used as a cache).
const clients = new Map<Region, Client>();
let currentRegion: Region | null = null;

function clientFor(region: Region): Client {
  let client = clients.get(region);
  if (!client) {
    const { url, publishableKey } = regionConfig(region);
    client = createClient<Database>(url, publishableKey, {
      auth: {
        // Keep the user signed in across app restarts. Each region gets its own
        // storage key so switching regions doesn't overwrite the other session.
        storage: AsyncStorage,
        storageKey: `familyboard.auth.${region}`,
        persistSession: true,
        autoRefreshToken: true,
        // Only meaningful in a web browser; we never sign in through a URL.
        detectSessionInUrl: false,
      },
    });
    clients.set(region, client);
  }
  return client;
}

/** The region this device is using, or null before onboarding has chosen one. */
export function getCurrentRegion(): Region | null {
  return currentRegion;
}

/** Call once at startup. Returns the saved region, or null on a fresh install. */
export async function restoreRegion(): Promise<Region | null> {
  currentRegion = await loadSavedRegion();
  return currentRegion;
}

/** Switch to a region's server and remember it for next time. */
export async function switchRegion(region: Region): Promise<void> {
  regionConfig(region); // throws early if this build has no server for the region
  currentRegion = region;
  await saveRegion(region);
}

/** The Supabase client for the current region. */
export function supabase(): Client {
  if (!currentRegion) {
    throw new Error('No region selected yet. Call restoreRegion() or switchRegion() first.');
  }
  return clientFor(currentRegion);
}

// Supabase refreshes the sign-in token on a timer. On a phone, timers pause while
// the app is in the background, so restart refreshing when the app comes back.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    for (const client of clients.values()) {
      if (state === 'active') {
        client.auth.startAutoRefresh();
      } else {
        client.auth.stopAutoRefresh();
      }
    }
  });
}
