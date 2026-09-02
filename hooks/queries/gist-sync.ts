import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GistSyncConfig } from '@/shared/gist-sync';
import { sendMessage } from '@/shared/messages';
import { queryKeys } from '../useBackgroundQueries';

export function useGistSyncConfigQuery() {
  return useQuery({
    queryKey: queryKeys.gistSync.config,
    queryFn: () => sendMessage('getGistSyncConfig'),
  });
}

export function useGistSyncStatusQuery() {
  return useQuery({
    queryKey: queryKeys.gistSync.status,
    queryFn: () => sendMessage('getGistSyncStatus'),
    refetchInterval: 15000,
  });
}

export function useSetGistSyncConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<GistSyncConfig>) => sendMessage('setGistSyncConfig', { config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gistSync.config });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.gistSync.all });
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
