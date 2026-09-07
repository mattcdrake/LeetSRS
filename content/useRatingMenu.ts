import { useCallback, useEffect, useRef, useState } from 'react';
import type { Translations } from '@/i18n';

// Keep asynchronous translation loading separate from presentation. Each interaction
// invalidates earlier requests, including when the toolbar unmounts.
export function useRatingMenu(getTranslations: () => Promise<Translations>, onError: (error: unknown) => void) {
  const [translations, setTranslations] = useState<Translations | null>(null);
  const requested = useRef(false);
  const version = useRef(0);

  const close = useCallback(() => {
    requested.current = false;
    version.current += 1;
    setTranslations(null);
  }, []);

  useEffect(
    () => () => {
      requested.current = false;
      version.current += 1;
    },
    []
  );

  const toggle = async () => {
    if (requested.current) {
      close();
      return;
    }
    requested.current = true;
    const request = ++version.current;
    try {
      const next = await getTranslations();
      if (request === version.current) setTranslations(next);
    } catch (error) {
      if (request !== version.current) return;
      requested.current = false;
      onError(error);
    }
  };

  return { translations, toggle, close };
}
