import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { Settings } from '@/domain/settings';
import { sendMessage } from '@/infrastructure/browser/messages';
import { getSettings } from '@/infrastructure/storage/learning-queries';

export const settingsQueryKeys = {
  all: ['settings'] as const,
};

export function useSettingsQuery() {
  return useSuspenseQuery({
    queryKey: settingsQueryKeys.all,
    networkMode: 'always',
    queryFn: () => getSettings(true),
  });
}

export function useUpdateSettingsMutation() {
  return useMutation({
    networkMode: 'always',
    mutationFn: (changes: Partial<Settings>) => sendMessage('updateSettings', { changes }),
  });
}
