import { useState } from 'react';

export function useDraftUntilSaved(savedValue: string) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? savedValue;

  return {
    value,
    hasDraft: draft !== null,
    setValue: (value: string) => setDraft(value),
    // Pass the saved value when it may differ from the value rendered with this callback.
    markSaved: (saved = value) => setDraft((current) => (current === saved ? null : current)),
    discard: () => setDraft(null),
  };
}
