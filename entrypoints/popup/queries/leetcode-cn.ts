import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { browser } from 'wxt/browser';

const LEETCODE_CN_ORIGIN = '*://*.leetcode.cn/*';
const permissionQueryKey = ['capabilities', 'leetcode-cn'] as const;

export function useLeetcodeCnCapability() {
  const queryClient = useQueryClient();
  const permission = useQuery({
    queryKey: permissionQueryKey,
    queryFn: () => browser.permissions.contains({ origins: [LEETCODE_CN_ORIGIN] }),
  });

  const enable = useCallback(async () => {
    // Keep the browser request in the synchronous user-interaction call stack.
    const granted = await browser.permissions.request({ origins: [LEETCODE_CN_ORIGIN] });
    await queryClient.cancelQueries({ queryKey: permissionQueryKey });
    queryClient.setQueryData(permissionQueryKey, granted);
    return granted;
  }, [queryClient]);

  return {
    granted: permission.data ?? null,
    isLoading: permission.isPending,
    error: permission.error,
    enable,
  };
}
