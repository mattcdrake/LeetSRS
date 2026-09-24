import { useSuspenseQuery } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import type { Settings } from '@/shared/settings';
import { resolveLearningDocumentSettings } from '@/shared/settings';
import { learningDocumentQueryOptions, useDocumentMutation } from './learning-document';

export function useSettingsQuery() {
  return useSuspenseQuery({
    ...learningDocumentQueryOptions,
    select: resolveLearningDocumentSettings,
  });
}

export function useUpdateSettingsMutation() {
  return useDocumentMutation((changes: Partial<Settings>) => background.updateSettings(changes));
}
