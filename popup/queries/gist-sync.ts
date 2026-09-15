import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import type { GistSetup } from '@/shared/models';
import { readGistConnection } from '@/shared/storage';

export const gistSyncQueryKeys = {
  all: ['gistSync'] as const,
  auth: ['gistSync', 'auth'] as const,
  config: ['gistSync', 'config'] as const,
  status: ['gistSync', 'status'] as const,
};

export function useGistSyncConfigQuery() {
  return useQuery({
    queryKey: gistSyncQueryKeys.config,
    queryFn: readGistConnection,
  });
}

export function useGistSyncStatusQuery() {
  return useQuery({
    queryKey: gistSyncQueryKeys.status,
    queryFn: () => background.getGistSyncStatus(),
    refetchInterval: 15000,
  });
}

export function useSetupGistSyncMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (setup: GistSetup) => background.setupGistSync(setup),
    onSuccess: () => client.invalidateQueries({ queryKey: gistSyncQueryKeys.all }),
  });
}

export function useSetGistSyncEnabledMutation() {
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (enabled: boolean) => background.setGistSyncEnabled(enabled),
    onSuccess: () => client.invalidateQueries({ queryKey: gistSyncQueryKeys.all }),
  });
}

export function useGithubAuthQuery() {
  return useQuery({
    queryKey: gistSyncQueryKeys.auth,
    queryFn: () => background.getGithubAuthStatus(),
    refetchInterval: (query) => (query.state.data?.signingIn ? 1000 : false),
  });
}
