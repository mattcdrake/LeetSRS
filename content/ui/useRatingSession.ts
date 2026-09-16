import { useCallback, useRef, useState } from 'react';
import type { Grade } from 'ts-fsrs';
import { background } from '@/shared/background-service';
import type { ProblemReference } from '@/shared/models';

// Lives with the toolbar control, so dismissal cannot lose an in-flight save.
export function useRatingSession(openRequest: number) {
  const [confirmation, setConfirmation] = useState<{ request: number; scheduledDays: number | null }>();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const saved = confirmation?.request === openRequest ? confirmation : undefined;

  const dismiss = useCallback(() => {
    if (saved && !pending.current) setConfirmation(undefined);
  }, [saved]);

  async function run(action: () => Promise<void>) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError(false);
    try {
      await action();
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return {
    saved,
    error,
    busy,
    dismiss,
    save(problem: ProblemReference, rating?: Grade) {
      if (saved) return;
      void run(async () => {
        let scheduledDays: number | null = null;
        if (rating === undefined) await background.addCard(problem);
        else scheduledDays = await background.rateCard({ ...problem, rating });
        setConfirmation({ request: openRequest, scheduledDays });
      });
    },
    disableAutoOpen() {
      return run(() => background.updateSettings({ openRatingAfterSolving: false }));
    },
  };
}
