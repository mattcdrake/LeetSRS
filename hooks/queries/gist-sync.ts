import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GistSyncConfig } from '@/shared/gist-sync';
import { sendMessage } from '@/shared/messages';

export const gistSyncQueryKeys = {
  all: ['gistSync'] as const,
  config: ['gistSync', 'config'] as const,
  status: ['gistSync', 'status'] as const,
};

export function useGistSyncConfigQuery() {
  return useQuery({
    queryKey: gistSyncQueryKeys.config,
    queryFn: () => sendMessage('getGistSyncConfig'),
  });
}

export function useGistSyncStatusQuery() {
  return useQuery({
    queryKey: gistSyncQueryKeys.status,
    queryFn: () => sendMessage('getGistSyncStatus'),
    refetchInterval: 15000,
  });
}

export function useSetGistSyncConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<GistSyncConfig>) => sendMessage('setGistSyncConfig', { config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gistSyncQueryKeys.config });
    },
  });
}

export function useTriggerGistSyncMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage('triggerGistSync'),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useCreateNewGistMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage('createNewGist'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gistSyncQueryKeys.all });
    },
  });
}

export function useValidatePatMutation() {
  return useMutation({
    mutationFn: (pat: string) => sendMessage('validatePat', { pat }),
  });
}

export function useValidateGistIdMutation() {
  return useMutation({
    mutationFn: ({ gistId, pat }: { gistId: string; pat: string }) => sendMessage('validateGistId', { gistId, pat }),
  });
}
