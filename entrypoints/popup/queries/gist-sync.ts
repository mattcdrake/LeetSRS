import { useMutation, useQuery } from '@tanstack/react-query';
import type { GistSetup } from '@/domain/gist-sync';
import { sendMessage } from '@/infrastructure/browser/messages';
import { readGistConnection } from '@/infrastructure/storage/gist-connection';
import { readLearningDocument } from '@/infrastructure/storage/learning-document';

export const gistSyncQueryKeys = {
  all: ['gistSync'] as const,
  config: ['gistSync', 'config'] as const,
  status: ['gistSync', 'status'] as const,
};

export function useGistSyncConfigQuery() {
  return useQuery({
    queryKey: gistSyncQueryKeys.config,
    networkMode: 'always',
    queryFn: async () => {
      await readLearningDocument(true);
      return readGistConnection();
    },
  });
}

export function useGistSyncStatusQuery() {
  return useQuery({
    queryKey: gistSyncQueryKeys.status,
    networkMode: 'always',
    queryFn: () => sendMessage('getGistSyncStatus'),
    refetchInterval: 15000,
  });
}

export function useSetupGistSyncMutation() {
  return useMutation({
    mutationFn: (setup: GistSetup) => sendMessage('setupGistSync', setup),
  });
}

export function useSetGistSyncEnabledMutation() {
  return useMutation({
    mutationFn: (enabled: boolean) => sendMessage('setGistSyncEnabled', { enabled }),
  });
}

export function useTriggerGistSyncMutation() {
  return useMutation({
    mutationFn: () => sendMessage('triggerGistSync'),
  });
}
