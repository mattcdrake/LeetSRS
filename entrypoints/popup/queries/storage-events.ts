import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { storage } from '#imports';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { cardQueryKeys } from './cards';
import { gistSyncQueryKeys } from './gist-sync';
import { settingsQueryKeys } from './settings';
import { statsQueryKeys } from './stats';

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
    const learningKeys = [cardQueryKeys.all, statsQueryKeys.all, settingsQueryKeys.all];
    const connectionKeys = [gistSyncQueryKeys.config, gistSyncQueryKeys.status];
    const watch = (key: Parameters<typeof storage.watch>[0], keys: readonly (readonly string[])[]) =>
      storage.watch(key, () => {
        void refresh(keys);
      });
    const unwatch = [
      watch(STORAGE_KEYS.learningDocument, learningKeys),
      watch(STORAGE_KEYS.gistConnection, connectionKeys),
      watch(STORAGE_KEYS.lastSyncTime, [gistSyncQueryKeys.status]),
      watch(STORAGE_KEYS.lastSyncDirection, [gistSyncQueryKeys.status]),
    ];
    // Catch changes made before this effect, including while a cached popup was unmounted.
    void refresh([...learningKeys, ...connectionKeys]);
    return () => {
      stopped = true;
      for (const stop of unwatch) stop();
    };
  }, [queryClient]);
}
