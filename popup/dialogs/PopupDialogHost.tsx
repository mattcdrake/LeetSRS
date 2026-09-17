import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { PopupDialogShell } from './PopupDialogShell';
import { dialogEligibilityQueryKey, type PopupDialogEntry, popupDialogRegistry } from './registry';

export function PopupDialogHost({ registry = popupDialogRegistry }: { registry?: readonly PopupDialogEntry[] }) {
  const eligibility = useQueries({
    queries: registry.map((entry) => ({
      queryKey: dialogEligibilityQueryKey(entry.id),
      queryFn: entry.loadEligibility,
    })),
  });
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Do not let a faster eligibility check show a later dialog out of order.
  if (eligibility.some((query) => !query.isSuccess)) return null;

  const current = registry.find((entry, index) => eligibility[index].data && !dismissedIds.includes(entry.id));
  if (!current) return null;

  const dismiss = () => setDismissedIds((ids) => [...ids, current.id]);
  const Content = current.Content;

  return (
    <PopupDialogShell key={current.id} onDismiss={dismiss}>
      <Content onDismiss={dismiss} />
    </PopupDialogShell>
  );
}
