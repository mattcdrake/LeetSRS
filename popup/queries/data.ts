import { useMutation } from '@tanstack/react-query';
import { readLearningDocument } from '@/data/learning-document';
import { sendMessage } from '@/integrations/browser/messages';

export function useExportDataMutation() {
  return useMutation({
    networkMode: 'always',
    mutationFn: async () => JSON.stringify(await readLearningDocument(true), null, 2),
  });
}

export function useImportDataMutation() {
  return useMutation({
    networkMode: 'always',
    mutationFn: (jsonData: string) => sendMessage('importData', { jsonData }),
  });
}

export function useResetAllDataMutation() {
  return useMutation({
    networkMode: 'always',
    mutationFn: () => sendMessage('resetAllData'),
  });
}
