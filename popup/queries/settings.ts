import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import type { Settings } from '@/shared/settings';
import { resolveLearningDocumentSettings } from '@/shared/settings';
import { learningDocumentQueryOptions } from './learning-document';

export function useSettingsQuery() {
  return useSuspenseQuery({
    ...learningDocumentQueryOptions,
    select: resolveLearningDocumentSettings,
  });
}

export function useUpdateSettingsMutation() {
  return useMutation({
    mutationFn: (changes: Partial<Settings>) => background.updateSettings(changes),
  });
}
