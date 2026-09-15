import { useState } from 'react';

export function useDraftUntilSaved(savedValue: string) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? savedValue;

  return {
    value,
    hasDraft: draft !== null,
    setValue: (value: string) => setDraft(value),
    markSaved: () => setDraft((current) => (current === value ? null : current)),
    discard: () => setDraft(null),
  };
}
