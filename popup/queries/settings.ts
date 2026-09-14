import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { resolveLearningDocumentSettings } from '@/data/learning-queries';
import type { Settings } from '@/domain/settings';
import { sendMessage } from '@/integrations/browser/messages';
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
