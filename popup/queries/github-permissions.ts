import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { browser } from 'wxt/browser';
import { background } from '@/shared/background-service';
import { GITHUB_HOST_PERMISSIONS } from '@/shared/gist-sync';
import { gistSyncQueryKeys } from './gist-sync';

const permissionQueryKey = ['capabilities', 'github'] as const;

export function useGithubPermissions() {
  const client = useQueryClient();
  const permission = useQuery({
    queryKey: permissionQueryKey,
    queryFn: () => browser.permissions.contains(GITHUB_HOST_PERMISSIONS),
    refetchOnMount: 'always',
  });
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({ queryKey: permissionQueryKey });
    };
    browser.permissions.onAdded.addListener(refresh);
    browser.permissions.onRemoved.addListener(refresh);
    return () => {
      browser.permissions.onAdded.removeListener(refresh);
      browser.permissions.onRemoved.removeListener(refresh);
    };
  }, [client]);

  const request = useMutation({
    mutationFn: async ({ permission, intent }: { permission: Promise<boolean>; intent: Promise<void> | null }) => {
      try {
        const [granted] = await Promise.all([permission, intent]);
        if (!granted) throw new Error('GitHub access denied');
      } catch (error) {
        if (intent) {
          await intent.catch(() => {});
          await background.cancelGithubSignInRequest();
        }
        throw error;
      }
    },
    networkMode: 'always',
    retry: false,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: permissionQueryKey });
      await client.invalidateQueries({ queryKey: gistSyncQueryKeys.all });
    },
  });
  const enable = (signIn: boolean) => {
    const intent = signIn ? background.startGithubSignIn() : null;
    // Preserve the click gesture: request before React Query's asynchronous lifecycle.
    let permission: Promise<boolean>;
    try {
      permission = browser.permissions.request(GITHUB_HOST_PERMISSIONS);
    } catch (error) {
      permission = Promise.reject(error);
    }
    request.mutate({ permission, intent });
  };
  return { granted: permission.data, isLoading: permission.isPending, error: permission.error, request, enable };
}
