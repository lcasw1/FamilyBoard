// Decides which of the recent messages Grandma's tablet shows, so a new message
// doesn't simply push the earlier ones off the screen:
//
//   - A new message is shown straight away.
//   - Every 2 minutes the tablet moves on to the next older message, and after the
//     oldest it starts again from the newest.
//   - Someone can also step through them by hand (the Earlier / Later buttons);
//     the tablet then stays on that message for 5 minutes before moving on.
//   - While a voice message is playing (`paused`), nothing changes.
//
// Usage:
//   const { index, go } = useRotation(messageIds, playing);
//   // show item `index`; go(+1) for an earlier message, go(-1) for a later one
import { useEffect, useRef, useState } from 'react';

export const ROTATE_MS = 2 * 60 * 1000;
export const MANUAL_HOLD_MS = 5 * 60 * 1000;

/** Moves `index` by `step` within a list of `length`, stopping at either end. */
export function stepIndex(index: number, step: number, length: number): number {
  return Math.min(Math.max(index + step, 0), Math.max(length - 1, 0));
}

/** The index after `index` for automatic turns: the next older one, then back to the newest. */
export function nextAutoIndex(index: number, length: number): number {
  return length > 0 ? (index + 1) % length : 0;
}

/** `ids` are the message ids, newest first. */
export function useRotation(ids: string[], paused: boolean) {
  // Remember *which message* is shown rather than its position: when a new
  // message arrives, every position shifts by one, but the id stays the same.
  const [shownId, setShownId] = useState<string | null>(null);
  const [delay, setDelay] = useState(ROTATE_MS);
  // The newest message we've already jumped to, so we only jump once per new message.
  const seenNewest = useRef<string | null>(null);

  const found = shownId === null ? -1 : ids.indexOf(shownId);
  // If the shown message is gone (deleted, hidden, older than a day), show the newest.
  const index = found === -1 ? 0 : found;
  const newest = ids[0] ?? null;
  // A string that only changes when the list really changes. The list itself is a
  // new array after every refresh, which would restart the timer each time.
  const idsKey = ids.join(',');

  // A new message arrived: show it. While a voice message plays, wait until it ends.
  useEffect(() => {
    if (newest !== null && newest !== seenNewest.current && !paused) {
      seenNewest.current = newest;
      setShownId(newest);
      setDelay(ROTATE_MS);
    }
  }, [newest, paused]);

  // Move on after `delay`. Showing a different message restarts the wait, because
  // `index` is one of the things this effect depends on.
  useEffect(() => {
    if (paused || ids.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      setShownId(ids[nextAutoIndex(index, ids.length)]);
      setDelay(ROTATE_MS);
    }, delay);
    return () => clearTimeout(timer);
    // `ids` is covered by `idsKey`; see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, idsKey, paused, delay]);

  /** Step by hand: +1 for an earlier message, -1 for a later one. */
  function go(step: number) {
    setShownId(ids[stepIndex(index, step, ids.length)] ?? null);
    setDelay(MANUAL_HOLD_MS);
  }

  return { index, go };
}
