import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';
import type { Settings } from '@/shared/settings';
import { cardQueryKeys } from './cards';
import { statsQueryKeys } from './stats';

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

      if ('maxNewCardsPerDay' in changes || 'dayStartHour' in changes) {
        queryClient.invalidateQueries({ queryKey: cardQueryKeys.reviewQueue });
      }

      if ('dayStartHour' in changes) {
        queryClient.invalidateQueries({ queryKey: statsQueryKeys.today });
        queryClient.invalidateQueries({ queryKey: statsQueryKeys.lastNDays.all });
        queryClient.invalidateQueries({ queryKey: statsQueryKeys.nextNDays.all });
      }
    },
  });
}
