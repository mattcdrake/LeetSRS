import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { getSettings } from '@/data/learning-queries';
import type { Settings } from '@/domain/settings';
import { sendMessage } from '@/integrations/browser/messages';

export const settingsQueryKeys = {
  all: ['settings'] as const,
};

export function useSettingsQuery() {
  return useSuspenseQuery({
    queryKey: settingsQueryKeys.all,
    queryFn: () => getSettings(true),
  });
}

export function useUpdateSettingsMutation() {
  return useMutation({
    mutationFn: (changes: Partial<Settings>) => sendMessage('updateSettings', { changes }),
  });
}
