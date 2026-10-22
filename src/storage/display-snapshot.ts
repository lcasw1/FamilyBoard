// What Grandma's tablet last showed, saved on the device so it can keep showing it
// when the internet is down, including straight after a restart.
//
// The photo or voice files themselves are saved separately (see cacheMedia in
// src/api/media.ts). A snapshot is only saved once all its files are on the
// device, so a saved snapshot can always be shown offline.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Message } from '@/api/messages';
import type { Language } from '@/i18n';

/** How far back the tablet goes: it takes turns showing the messages of the last day. */
export const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
/** At most this many messages take turns, even on a very busy day. */
export const MAX_RECENT_MESSAGES = 20;

export type DisplayItem = {
  message: Message;
  /** Who sent it, e.g. 'Lily'. Null if they have left the family. */
  senderName: string | null;
};

export type DisplaySnapshot = {
  /** The tablet's language, chosen by the family (families.display_language). */
  language: Language;
  /** The messages to show, newest first. Empty if the family hasn't sent anything yet. */
  items: DisplayItem[];
};

/**
 * Picks the messages the tablet takes turns showing: those sent in the last 24
 * hours, newest first. On a day with no messages, the newest one stays, so the
 * screen never goes empty just because a day passed.
 *
 *   recentForDisplay([today2, today1, lastWeek], now) -> [today2, today1]
 *   recentForDisplay([lastWeek, older], now)          -> [lastWeek]
 */
export function recentForDisplay<T extends { created_at: string }>(
  newestFirst: T[],
  now: Date,
): T[] {
  const since = now.getTime() - RECENT_WINDOW_MS;
  const recent = newestFirst
    .filter((message) => new Date(message.created_at).getTime() >= since)
    .slice(0, MAX_RECENT_MESSAGES);
  return recent.length > 0 ? recent : newestFirst.slice(0, 1);
}

function keyFor(familyId: string): string {
  return `familyboard.display.${familyId}`;
}

function isItem(value: unknown): value is DisplayItem {
  const item = value as DisplayItem | null;
  const senderOk = item?.senderName === null || typeof item?.senderName === 'string';
  return typeof item?.message?.id === 'string' && senderOk;
}

/** Turns the saved text back into a snapshot, or null if it is missing or damaged. */
export function parseDisplaySnapshot(saved: string | null): DisplaySnapshot | null {
  if (!saved) {
    return null;
  }
  try {
    const value = JSON.parse(saved);
    if (value?.language !== 'en' && value?.language !== 'zh-CN') {
      return null;
    }
    if (Array.isArray(value.items) && value.items.every(isItem)) {
      return { language: value.language, items: value.items };
    }
    // Saved by an older version of the app, which kept only the newest message:
    // { language, message, senderName }. Read it as a list of zero or one.
    if (value.message === null) {
      return { language: value.language, items: [] };
    }
    const oldItem = { message: value.message, senderName: value.senderName };
    if (isItem(oldItem)) {
      return { language: value.language, items: [oldItem] };
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
