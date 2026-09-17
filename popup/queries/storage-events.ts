import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { storage } from '#imports';
import { STORAGE_KEYS } from '@/shared/storage';
import { gistSyncQueryKeys } from './gist-sync';
import { learningDocumentQueryKey } from './learning-document';
import { activeRoadmapQueryOptions } from './roadmaps';

// Mount outside Suspense so initialization and the first query cannot hide subscriptions.
export function useStorageQueryEvents() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let stopped = false;
    const refresh = async (queryKeys: readonly (readonly string[])[]) => {
      await Promise.all(queryKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })));
      if (stopped) return;
      await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    };
    const learningKeys = [learningDocumentQueryKey];
    const connectionKeys = [gistSyncQueryKeys.config, gistSyncQueryKeys.status];
    const watch = (key: Parameters<typeof storage.watch>[0], keys: readonly (readonly string[])[]) =>
      storage.watch(key, () => {
        void refresh(keys);
      });
    const unwatch = [
      watch(STORAGE_KEYS.learningDocument, learningKeys),
      watch(STORAGE_KEYS.activeRoadmapId, [activeRoadmapQueryOptions.queryKey]),
      watch(STORAGE_KEYS.gistConnection, connectionKeys),
      watch('local:leetsrs:githubAuthorization', [gistSyncQueryKeys.auth]),
      watch('local:leetsrs:githubSetupPending', [gistSyncQueryKeys.auth]),
      watch(STORAGE_KEYS.lastSyncTime, [gistSyncQueryKeys.status]),
    ];
    // Catch changes made before this effect, including while a cached popup was unmounted.
    void refresh([...learningKeys, ...connectionKeys, activeRoadmapQueryOptions.queryKey]);
    return () => {
      stopped = true;
      for (const stop of unwatch) stop();
    };
  }, [queryClient]);
}
