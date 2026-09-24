import { useMutation, useQuery } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import { readPopupDialogAcknowledgments } from '@/shared/popup-dialogs';

export const popupDialogAcknowledgmentsQueryKey = ['popupDialogs', 'acknowledgments'] as const;

export function usePopupDialogAcknowledgmentsQuery() {
  return useQuery({
    queryKey: popupDialogAcknowledgmentsQueryKey,
    queryFn: readPopupDialogAcknowledgments,
  });
}

export function useAcknowledgePopupDialogMutation() {
  return useMutation({
    mutationFn: (id: string) => background.acknowledgePopupDialog(id),
    retry: false,
    onError: (error) => console.warn('Failed to acknowledge popup dialog:', error),
  });
}
