import { useRef, useState } from 'react';
import { background } from '@/shared/background-service';
import type { PanelRatingInput, PanelSave } from '@/shared/models';

// Lives with the toolbar control, so dismissal cannot lose an in-flight save or Undo.
export function useRatingSession(openRequest: number) {
  const [confirmation, setConfirmation] = useState<{ request: number; result: PanelSave }>();
  const [error, setError] = useState<'save' | 'undo'>();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const saved = confirmation?.request === openRequest ? confirmation.result : undefined;

  async function run(action: () => Promise<void>, failure: 'save' | 'undo' = 'save') {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await action();
      return true;
    } catch {
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
    dismiss() {
      if (saved && !pending.current) setConfirmation(undefined);
    },
    save(input: PanelRatingInput) {
      if (saved) return;
      void run(async () => {
        const result = await background.savePanelRating(input);
        setConfirmation({ request: openRequest, result });
      });
    },
    undo() {
      return run(async () => {
        if (!saved) return;
        await background.undoPanelRating(saved.undo);
        setConfirmation(undefined);
      }, 'undo');
    },
    disableAutoOpen() {
      return run(() => background.updateSettings({ openRatingAfterSolving: false }));
    },
  };
}
