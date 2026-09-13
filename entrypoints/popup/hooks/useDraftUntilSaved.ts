import { useEffect, useState } from 'react';

export function useDraftUntilSaved(key: string, savedValue: string) {
  const [draft, setDraft] = useState<{ key: string; value: string } | null>(null);
  const hasDraft = draft?.key === key;
  const value = hasDraft ? draft.value : savedValue;

  useEffect(() => {
    setDraft((current) => (current?.key === key ? current : null));
  }, [key]);

  return {
    value,
    hasDraft,
    setValue: (value: string) => setDraft({ key, value }),
    markSaved: () => setDraft((current) => (current?.key === key && current.value === value ? null : current)),
    discard: () => setDraft((current) => (current?.key === key ? null : current)),
  };
}
