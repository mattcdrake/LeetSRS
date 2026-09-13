import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { readGistConnection } from '@/data/gist-connection';
import { readLearningDocument } from '@/data/learning-document';
import type { GistSetup } from '@/domain/gist-sync';
import { sendMessage } from '@/integrations/browser/messages';

export const gistSyncQueryKeys = {
  all: ['gistSync'] as const,
  config: ['gistSync', 'config'] as const,
  status: ['gistSync', 'status'] as const,
  arrival: ['gistSync', 'arrival'] as const,
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
    networkMode: 'always',
    mutationFn: (enabled: boolean) => sendMessage('setGistSyncEnabled', { enabled }),
  });
}

export function useTriggerGistSyncMutation() {
  return useMutation({
    mutationFn: () => sendMessage('triggerGistSync'),
  });
}

export function useArrivalRefresh() {
  const refresh = useMutation({
    mutationKey: gistSyncQueryKeys.arrival,
    networkMode: 'always',
    mutationFn: () => sendMessage('refreshGistOnArrival'),
  });
  useEffect(() => refresh.mutate(), [refresh.mutate]);
  return refresh;
}
