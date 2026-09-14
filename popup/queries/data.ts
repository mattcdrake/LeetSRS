import { useMutation } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';
import { readLearningDocument } from '@/shared/storage';

export function useExportDataMutation() {
  return useMutation({
    mutationFn: async () => JSON.stringify(await readLearningDocument(), null, 2),
  });
}

export function useImportDataMutation() {
  return useMutation({
    mutationFn: (jsonData: string) => sendMessage('importData', { jsonData }),
  });
}

export function useResetAllDataMutation() {
  return useMutation({
    mutationFn: () => sendMessage('resetAllData'),
  });
}
