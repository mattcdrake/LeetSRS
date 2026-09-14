import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';
import type { Settings } from '@/shared/settings';
import { resolveLearningDocumentSettings } from '@/shared/settings';
import { learningDocumentQueryOptions } from './learning-document';

export function useSettingsQuery() {
  return useSuspenseQuery({
    ...learningDocumentQueryOptions,
    select: ({ document }) => resolveLearningDocumentSettings(document),
  });
}

export function useUpdateSettingsMutation() {
  return useMutation({
    mutationFn: (changes: Partial<Settings>) => sendMessage('updateSettings', { changes }),
  });
}
