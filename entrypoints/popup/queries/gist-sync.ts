import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GistSetup } from '@/domain/gist-sync';
import { sendMessage } from '@/infrastructure/browser/messages';

export const gistSyncQueryKeys = {
  all: ['gistSync'] as const,
  config: ['gistSync', 'config'] as const,
  status: ['gistSync', 'status'] as const,
};

export function useGistSyncConfigQuery() {
  return useQuery({
    queryKey: gistSyncQueryKeys.config,
    queryFn: () => sendMessage('getGistSyncConfig'),
    refetchInterval: 15000,
  });
}

export function useGistSyncStatusQuery() {
  return useQuery({
    queryKey: gistSyncQueryKeys.status,
    queryFn: () => sendMessage('getGistSyncStatus'),
    refetchInterval: 15000,
  });
}

export function useSetupGistSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (setup: GistSetup) => sendMessage('setupGistSync', setup),
    // A pull may have completed even if status persistence or the response failed.
    onSettled: () => queryClient.invalidateQueries(),
  });
}

export function useSetGistSyncEnabledMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => sendMessage('setGistSyncEnabled', { enabled }),
    onSettled: () => queryClient.invalidateQueries(),
  });
}

export function useTriggerGistSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sendMessage('triggerGistSync'),
    onSettled: () => queryClient.invalidateQueries(),
  });
}
