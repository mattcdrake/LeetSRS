import { useCallback, useRef, useState } from 'react';
import type { Grade } from 'ts-fsrs';
import { background } from '@/shared/background-service';
import type { ProblemReference } from '@/shared/learning-document';

export type SavedConfirmation = {
  request: number;
  rating?: Grade;
  scheduledDays: number;
  due: number;
  undoToken: string;
};

// Lives with the toolbar control, so dismissal cannot lose an in-flight save.
export function useRatingSession(openRequest: number) {
  const [confirmation, setConfirmation] = useState<SavedConfirmation>();
  const [error, setError] = useState<'save' | 'undo'>();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const saved = confirmation?.request === openRequest ? confirmation : undefined;

  const dismiss = useCallback(() => {
    if (saved && !pending.current) {
      setConfirmation(undefined);
      setError(undefined);
    }
  }, [saved]);

  async function run(action: () => Promise<void>, failure: 'save' | 'undo') {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await action();
      return true;
    } catch (error) {
      console.error('LeetSRS rating panel action failed:', error);
      setError(failure);
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
        const { card, undoToken } = await background.saveProblem({ ...problem, rating });
        setConfirmation({
          request: openRequest,
          rating,
          scheduledDays: card.fsrs.scheduled_days,
          due: card.fsrs.due,
          undoToken,
        });
      }, 'save');
    },
    undo() {
      const token = saved?.undoToken;
      if (!token) return Promise.resolve(false);
      return run(async () => {
        await background.undoSave(token);
        setConfirmation(undefined);
      }, 'undo');
    },
    disableAutoOpen() {
      return run(() => background.updateSettings({ openRatingAfterSolving: false }), 'save');
    },
  };
}
