import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';
import type { Settings } from '@/shared/settings';
import { queryKeys } from '../useBackgroundQueries';

export function useSettingsQuery() {
  return useSuspenseQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => sendMessage('getSettings'),
  });
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changes: Partial<Settings>) => sendMessage('updateSettings', { changes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.reviewQueue });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}
