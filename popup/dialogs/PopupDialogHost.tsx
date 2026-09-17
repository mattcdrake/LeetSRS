import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { useAcknowledgePopupDialogMutation, usePopupDialogAcknowledgmentsQuery } from '@/popup/queries/popup-dialogs';
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
  const acknowledgments = usePopupDialogAcknowledgmentsQuery();
  const acknowledge = useAcknowledgePopupDialogMutation();

  // Load both sources before selecting a dialog, and finish saving before advancing.
  if (!acknowledgments.isSuccess || eligibility.some((query) => !query.isSuccess) || acknowledge.isPending) return null;

  const current = registry.find(
    (entry, index) =>
      eligibility[index].data && acknowledgments.data[entry.id] !== true && !dismissedIds.includes(entry.id)
  );
  if (!current) return null;

  const dismiss = () => {
    // Close immediately and keep it dismissed in this popup even if saving fails.
    setDismissedIds((ids) => [...ids, current.id]);
    acknowledge.mutate(current.id);
  };
  const Content = current.Content;

  return (
    <PopupDialogShell key={current.id} onDismiss={dismiss}>
      <Content onDismiss={dismiss} />
    </PopupDialogShell>
  );
}
