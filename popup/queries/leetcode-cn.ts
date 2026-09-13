import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { browser } from 'wxt/browser';

const LEETCODE_CN_ORIGIN = '*://*.leetcode.cn/*';
const permissionQueryKey = ['capabilities', 'leetcode-cn'] as const;

export function useLeetcodeCnCapability() {
  const queryClient = useQueryClient();
  const permission = useQuery({
    queryKey: permissionQueryKey,
    queryFn: () => browser.permissions.contains({ origins: [LEETCODE_CN_ORIGIN] }),
    refetchOnMount: 'always', // Permissions may change while the popup is closed.
  });

  const requestMutation = useMutation({
    mutationFn: (request: Promise<boolean>) => request,
    retry: false,
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
