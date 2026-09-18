import { useQueries } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { useAcknowledgePopupDialogMutation, usePopupDialogAcknowledgmentsQuery } from '@/popup/queries/popup-dialogs';
import { background } from '@/shared/background-service';
import { PopupDialogShell } from './PopupDialogShell';
import { dialogEligibilityQueryKey, type PopupDialogEntry, popupDialogRegistry } from './registry';

export function PopupDialogHost({
  registry = popupDialogRegistry,
  onOpenRoadmaps,
}: {
  registry?: readonly PopupDialogEntry[];
  onOpenRoadmaps: () => void;
}) {
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
  const ready = acknowledgments.isSuccess && eligibility.every((query) => query.isSuccess) && !acknowledge.isPending;
  const current = ready
    ? registry.find(
        (entry, index) =>
          eligibility[index].data && acknowledgments.data[entry.id] !== true && !dismissedIds.includes(entry.id)
      )
    : undefined;
  const displayedId = useRef<string | null>(null);
  useLayoutEffect(() => {
    displayedId.current = current?.id ?? null;
    const onPopupClose = () => {
      const id = displayedId.current;
      if (!id) return;
      displayedId.current = null;
      // Dispatch directly: the background owns the save after this popup is gone.
      void background.acknowledgePopupDialog(id).catch((error) => {
        console.warn('Failed to acknowledge popup dialog:', error);
      });
    };
    window.addEventListener('pagehide', onPopupClose);
    return () => window.removeEventListener('pagehide', onPopupClose);
  }, [current?.id]);

  if (!current) return null;

  const dismiss = () => {
    displayedId.current = null;
    // Close immediately and keep it dismissed in this popup even if saving fails.
    setDismissedIds((ids) => [...ids, current.id]);
    acknowledge.mutate(current.id);
  };
  const Content = current.Content;

  return (
    <PopupDialogShell key={current.id} onDismiss={dismiss}>
      <Content onDismiss={dismiss} onOpenRoadmaps={onOpenRoadmaps} />
    </PopupDialogShell>
  );
}
