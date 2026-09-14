import { useMutation, useQuery } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';
import type { GistSetup } from '@/shared/models';
import { readGistConnection, readLearningDocument } from '@/shared/storage';

export const gistSyncQueryKeys = {
  config: ['gistSync', 'config'] as const,
  status: ['gistSync', 'status'] as const,
};

export function useGistSyncConfigQuery() {
  return useQuery({
    queryKey: gistSyncQueryKeys.config,
    queryFn: async () => {
      await readLearningDocument(true);
      return readGistConnection();
    },
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
  return useMutation({
    mutationFn: (setup: GistSetup) => sendMessage('setupGistSync', setup),
  });
}

export function useSetGistSyncEnabledMutation() {
  return useMutation({
    mutationFn: (enabled: boolean) => sendMessage('setGistSyncEnabled', { enabled }),
  });
}
