import { useMutation, useQuery } from '@tanstack/react-query';
import { readGistConnection } from '@/data/gist-connection';
import { readLearningDocument } from '@/data/learning-document';
import type { GistSetup } from '@/domain/gist-sync';
import { sendMessage } from '@/integrations/browser/messages';

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
