// Runs an async action from a button press and tracks its state, so screens don't
// repeat the same busy/error bookkeeping.
//
// Usage:
//   const { busy, error, run } = useAction();
//   <Button busy={busy} onPress={() => run(async () => { await doSomething(); })} />
//   <ErrorMessage error={error} />
import { useState } from 'react';

import { ApiError, toApiError } from '@/api/errors';

export function useAction() {
  // useState is how a component remembers a value between redraws. Calling the
  // setter (setBusy) stores the new value and redraws the screen.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function run(action: () => Promise<void>): Promise<void> {
    if (busy) {
      return; // ignore double taps while the first one is still running
    }
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run, setError };
}
