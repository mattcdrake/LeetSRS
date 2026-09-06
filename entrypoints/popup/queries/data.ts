import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '@/infrastructure/browser/messages';

export function useExportDataMutation() {
  return useMutation({
    mutationFn: () => sendMessage('exportData'),
  });
}

export function useImportDataMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jsonData: string) => sendMessage('importData', { jsonData }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useResetAllDataMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage('resetAllData'),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
