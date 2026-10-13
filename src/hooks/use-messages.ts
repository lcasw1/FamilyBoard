// Loads a family's recent messages and members, and reloads them whenever a
// message is added, changed or deleted (via the real-time subscription).
//
// Usage:
//   const { messages, members, error, reload } = useMessages(familyId);
import { useCallback, useEffect, useRef, useState } from 'react';

import { toApiError, type ApiError } from '@/api/errors';
import { listMembers, type Member } from '@/api/families';
import { listMessages, subscribeToMessages, type Message } from '@/api/messages';

const RECENT_MESSAGE_COUNT = 20;

export function useMessages(familyId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  // useRef keeps a value between redraws without causing one. Each reload takes
  // a number, so if two overlap, only the newest one's answer is kept.
  const latestRequest = useRef(0);

  // useCallback keeps the same `reload` function between redraws (unless
  // familyId changes), so the effect below doesn't re-subscribe on every redraw.
  // The state is only set inside .then() callbacks, after the answer arrives.
  const reload = useCallback(() => {
    const request = ++latestRequest.current;
    Promise.all([listMessages(familyId, RECENT_MESSAGE_COUNT), listMembers(familyId)]).then(
      ([newMessages, newMembers]) => {
        if (request === latestRequest.current) {
          setMessages(newMessages);
          setMembers(newMembers);
          setError(null);
        }
      },
      (caught) => {
        if (request === latestRequest.current) {
          setError(toApiError(caught));
        }
      },
    );
  }, [familyId]);

  useEffect(() => {
    reload();
    // subscribeToMessages returns its "stop listening" function, and returning
    // that from the effect makes React call it when the screen goes away.
    return subscribeToMessages(familyId, reload);
  }, [familyId, reload]);

  return { messages, members, error, reload };
}
