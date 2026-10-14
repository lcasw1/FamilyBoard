// What Grandma's tablet last showed, saved on the device so it can keep showing it
// when the internet is down, including straight after a restart.
//
// The photo or voice file itself is saved separately (see cacheMedia in
// src/api/media.ts). A snapshot is only saved once its file is on the device, so
// a saved snapshot can always be shown offline.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Message } from '@/api/messages';
import type { Language } from '@/i18n';

export type DisplaySnapshot = {
  /** The tablet's language, chosen by the family (families.display_language). */
  language: Language;
  /** The newest message, or null if the family hasn't sent anything yet. */
  message: Message | null;
  /** Who sent it, e.g. 'Lily'. Null if they have left the family. */
  senderName: string | null;
};

function keyFor(familyId: string): string {
  return `familyboard.display.${familyId}`;
}

/** Turns the saved text back into a snapshot, or null if it is missing or damaged. */
export function parseDisplaySnapshot(saved: string | null): DisplaySnapshot | null {
  if (!saved) {
    return null;
  }
  try {
    const value = JSON.parse(saved);
    const languageOk = value?.language === 'en' || value?.language === 'zh-CN';
    const messageOk = value?.message === null || typeof value?.message?.id === 'string';
    const senderOk = value?.senderName === null || typeof value?.senderName === 'string';
    if (languageOk && messageOk && senderOk) {
      return value as DisplaySnapshot;
    }
  } catch {
    // Not valid JSON: treat it as nothing saved.
  }
  return null;
}

export async function loadDisplaySnapshot(familyId: string): Promise<DisplaySnapshot | null> {
  return parseDisplaySnapshot(await AsyncStorage.getItem(keyFor(familyId)));
}

export async function saveDisplaySnapshot(
  familyId: string,
  snapshot: DisplaySnapshot,
): Promise<void> {
  await AsyncStorage.setItem(keyFor(familyId), JSON.stringify(snapshot));
}
