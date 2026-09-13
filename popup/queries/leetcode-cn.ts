import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { browser } from 'wxt/browser';

const LEETCODE_CN_ORIGIN = '*://*.leetcode.cn/*';
const permissionQueryKey = ['capabilities', 'leetcode-cn'] as const;

// Mount once at the popup root; consumers only observe the shared query.
export function useLeetcodeCnPermissionEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = async (permissions: { origins?: string[] }) => {
      if (!permissions.origins?.length) return;

      // Cancel even the initial check, which invalidation alone can reuse.
      await queryClient.cancelQueries({ queryKey: permissionQueryKey });
      await queryClient.invalidateQueries({ queryKey: permissionQueryKey });
    };

    browser.permissions.onAdded.addListener(refresh);
    browser.permissions.onRemoved.addListener(refresh);

    return () => {
      browser.permissions.onAdded.removeListener(refresh);
      browser.permissions.onRemoved.removeListener(refresh);
    };
  }, [queryClient]);
}

export function useLeetcodeCnCapability() {
  const queryClient = useQueryClient();
  const permission = useQuery({
    queryKey: permissionQueryKey,
    queryFn: () => browser.permissions.contains({ origins: [LEETCODE_CN_ORIGIN] }),
    networkMode: 'always',
    refetchOnMount: 'always', // Permissions may change while the popup is closed.
  });

  const requestMutation = useMutation({
    mutationFn: (request: Promise<boolean>) => request,
    retry: false,
    networkMode: 'always',
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: permissionQueryKey });
      await queryClient.invalidateQueries({ queryKey: permissionQueryKey });
    },
  });

  const { mutate } = requestMutation;
  const enable = useCallback(() => {
    // Start the request before React Query's asynchronous mutation lifecycle.
    const request = browser.permissions.request({ origins: [LEETCODE_CN_ORIGIN] });
    return mutate(request);
  }, [mutate]);

  return {
    granted: permission.data ?? null,
    isLoading: permission.isPending,
    error: permission.error,
    enable,
    isEnabling: requestMutation.isPending,
    enableError: requestMutation.error,
  };
}
