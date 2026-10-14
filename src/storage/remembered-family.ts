// Remembers which family this device belongs to, and in what role, so the app can
// start without internet. Grandma's tablet needs this: after a power cut or a
// restart it must go straight back to her display even if the Wi-Fi is down.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Role } from '@/api/families';

export type RememberedFamily = {
  familyId: string;
  role: Role;
};

const KEY = 'familyboard.family';
const ROLES: readonly string[] = ['display', 'sender', 'aide', 'admin'];

/**
 * Turns the saved text back into a RememberedFamily, or null if it is missing or
 * not in the expected shape (for example, saved by an older version of the app).
 */
export function parseRememberedFamily(saved: string | null): RememberedFamily | null {
  if (!saved) {
    return null;
  }
  try {
    const value = JSON.parse(saved);
    if (typeof value?.familyId === 'string' && ROLES.includes(value?.role)) {
      return { familyId: value.familyId, role: value.role };
    }
  } catch {
    // Not valid JSON: treat it as nothing saved.
  }
  return null;
}

export async function loadRememberedFamily(): Promise<RememberedFamily | null> {
  return parseRememberedFamily(await AsyncStorage.getItem(KEY));
}

export async function rememberFamily(family: RememberedFamily): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(family));
}

export async function forgetFamily(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
