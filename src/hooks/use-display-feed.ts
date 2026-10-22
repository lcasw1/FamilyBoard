// What Grandma's tablet shows: the family's messages from the last day (see
// recentForDisplay), kept up to date and kept working offline. useRotation then
// decides which one is on screen.
//
// 1. On start, show the snapshot saved last time straight away (works offline).
// 2. Then fetch the recent messages, download their photo and voice files, and
//    only then switch to them and save them as the new snapshot. If anything fails (no
//    internet, server down), the tablet simply keeps showing what it had.
// 3. Fetch again when a message is sent or deleted (real-time), every few minutes
//    (hiding a message sends the tablet no real-time update), and when the app
//    comes back to the front.
//
// Usage:
//   const snapshot = useDisplayFeed(familyId); // null until there is something to show
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getFamily, listMembers } from '@/api/families';
import { cacheMedia, pruneMediaCache } from '@/api/media';
import { listMessages, subscribeToMessages } from '@/api/messages';
import type { Language } from '@/i18n';
import {
  loadDisplaySnapshot,
  MAX_RECENT_MESSAGES,
  recentForDisplay,
  saveDisplaySnapshot,
  type DisplaySnapshot,
} from '@/storage/display-snapshot';

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

/** Fetches the recent messages and makes sure all their files are on the device. */
async function fetchSnapshot(familyId: string): Promise<DisplaySnapshot> {
  // Promise.all runs the three requests at the same time and waits for all of them.
  const [family, messages, members] = await Promise.all([
    getFamily(familyId),
    // The tablet never receives hidden messages (the database filters them out).
    listMessages(familyId, MAX_RECENT_MESSAGES),
    listMembers(familyId),
  ]);
  const recent = recentForDisplay(messages, new Date());
  // Download every file before switching, so whichever message is on screen works
  // offline. If one download fails, the whole refresh fails and nothing changes.
  await Promise.all(
    recent.map((message) => (message.file_path ? cacheMedia(message.file_path) : null)),
  );
  const items = recent.map((message) => ({
    message,
    senderName:
      members.find((member) => member.user_id === message.sender_id)?.display_name ?? null,
  }));
  const language: Language = family.display_language === 'zh-CN' ? 'zh-CN' : 'en';
  return { language, items };
}

export function useDisplayFeed(familyId: string): DisplaySnapshot | null {
  const [snapshot, setSnapshot] = useState<DisplaySnapshot | null>(null);
  // Each refresh takes a number; only the newest refresh's answer is used.
  const latestRequest = useRef(0);

  // Step 1: what was saved last time.
  useEffect(() => {
    let cancelled = false;
    loadDisplaySnapshot(familyId).then((saved) => {
      // `current ?? saved`: if fresh data already arrived, keep it instead.
      if (!cancelled && saved) setSnapshot((current) => current ?? saved);
    });
    return () => {
      cancelled = true;
    };
  }, [familyId]);

  // Step 2.
  const refresh = useCallback(() => {
    const request = ++latestRequest.current;
    fetchSnapshot(familyId).then(
      (fresh) => {
        if (request !== latestRequest.current) {
          return;
        }
        setSnapshot(fresh);
        saveDisplaySnapshot(familyId, fresh).catch(() => {});
        // Delete downloaded files of messages that are no longer shown.
        const filePaths = fresh.items.map(({ message }) => message.file_path);
        pruneMediaCache(filePaths.filter((path) => path !== null));
      },
      () => {
        // Offline or a server problem: keep showing the current snapshot.
      },
    );
  }, [familyId]);

  // Step 3.
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const stopListening = subscribeToMessages(familyId, refresh);
    // React calls this when the screen goes away: stop everything started above.
    return () => {
      clearInterval(timer);
      appState.remove();
      stopListening();
    };
  }, [familyId, refresh]);

  return snapshot;
}
