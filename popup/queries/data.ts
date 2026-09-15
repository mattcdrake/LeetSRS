import { useMutation } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import { readLearningDocument } from '@/shared/storage';

export function useExportDataMutation() {
  return useMutation({
    mutationFn: async () => JSON.stringify(await readLearningDocument(), null, 2),
  });
}

export function useImportDataMutation() {
  return useMutation({
    mutationFn: (jsonData: string) => background.importData(jsonData),
  });
}

export function useResetAllDataMutation() {
  return useMutation({
    mutationFn: () => background.resetAllData(),
  });
}
