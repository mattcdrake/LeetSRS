import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { Settings } from '@/domain/settings';
import { sendMessage } from '@/infrastructure/browser/messages';
import { cardQueryKeys } from './cards';

export const settingsQueryKeys = {
  all: ['settings'] as const,
};

export function useSettingsQuery() {
  return useSuspenseQuery({
    queryKey: settingsQueryKeys.all,
    queryFn: () => sendMessage('getSettings'),
  });
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changes: Partial<Settings>) => sendMessage('updateSettings', { changes }),
    onSuccess: (_data, changes) => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all });

      if ('maxNewCardsPerDay' in changes) {
        queryClient.invalidateQueries({ queryKey: cardQueryKeys.all });
      }
    },
  });
}
