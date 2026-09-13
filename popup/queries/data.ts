import { useMutation } from '@tanstack/react-query';
import { readLearningDocument } from '@/data/learning-document';
import { sendMessage } from '@/integrations/browser/messages';

export function useExportDataMutation() {
  return useMutation({
    mutationFn: async () => JSON.stringify(await readLearningDocument(true), null, 2),
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
