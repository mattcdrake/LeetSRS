import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { WxtStorageItem } from '#imports';
import {
  gistConnectionItem,
  githubAuthorizationItem,
  githubSetupPendingItem,
  lastSyncTimeItem,
} from '@/shared/gist-sync';
import { learningDocumentItem } from '@/shared/learning-document';
import { patMigrationItem } from '@/shared/legacy/github-pat';
import { popupDialogAcknowledgmentsItem } from '@/shared/popup-dialogs';
import { gistSyncQueryKeys } from './gist-sync';
import { learningDocumentQueryKey } from './learning-document';
import { popupDialogAcknowledgmentsQueryKey } from './popup-dialogs';

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
    const dialogKeys = [popupDialogAcknowledgmentsQueryKey];
    const eligibilityKeys = [['popupDialogs', 'eligibility']];
    const watch = (
      item: Pick<WxtStorageItem<unknown, Record<string, never>>, 'watch'>,
      keys: readonly (readonly string[])[]
    ) =>
      item.watch(() => {
        void refresh(keys);
      });
    const unwatch = [
      watch(learningDocumentItem, learningKeys),
      watch(popupDialogAcknowledgmentsItem, dialogKeys),
      watch(gistConnectionItem, connectionKeys),
      watch(patMigrationItem, [gistSyncQueryKeys.auth]),
      watch(githubAuthorizationItem, [gistSyncQueryKeys.auth]),
      watch(githubSetupPendingItem, [gistSyncQueryKeys.auth]),
      watch(lastSyncTimeItem, [gistSyncQueryKeys.status]),
    ];
    // Catch changes made before this effect, including while a cached popup was unmounted.
    void refresh([...learningKeys, ...connectionKeys, ...dialogKeys, ...eligibilityKeys]);
    return () => {
      stopped = true;
      for (const stop of unwatch) stop();
    };
  }, [queryClient]);
}
