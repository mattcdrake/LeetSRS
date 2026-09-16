import { useCallback, useEffect, useRef, useState } from 'react';

const CONFIRMATION_TIMEOUT_MS = 3000;

export function useTimedConfirmation() {
  const [isConfirming, setIsConfirming] = useState(false);
  const isConfirmingRef = useRef(false);
  const isActionPendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetConfirmation = useCallback(() => {
    clearTimer();
    isConfirmingRef.current = false;
    setIsConfirming(false);
  }, [clearTimer]);

  const startOrConfirm = useCallback(
    async (action: () => void | Promise<void>) => {
      if (!isConfirmingRef.current) {
        isConfirmingRef.current = true;
        setIsConfirming(true);
        timerRef.current = setTimeout(resetConfirmation, CONFIRMATION_TIMEOUT_MS);
        return;
      }

      if (isActionPendingRef.current) {
        return;
      }

      isActionPendingRef.current = true;
      clearTimer();

      try {
        const result = action();
        if (result) {
          await result;
        }
      } finally {
        isActionPendingRef.current = false;
        resetConfirmation();
      }
    },
    [clearTimer, resetConfirmation]
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { isConfirming, startOrConfirm };
}
