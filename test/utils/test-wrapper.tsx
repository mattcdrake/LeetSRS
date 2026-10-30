import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { useStorageQueryEvents } from '@/popup/queries/storage-events';
import { createPopupQueryClient } from '@/popup/query-client';

function StorageObserver() {
  useStorageQueryEvents();
  return null;
}

export function createPopupTestWrapper() {
  const queryClient = createPopupQueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  // biome-ignore lint/correctness/noComponentHookFactories: each test needs a wrapper bound to its own client; it is created once per test, not per render.
  function Wrapper({ children }: { children: ReactNode }) {
    useEffect(() => () => queryClient.clear(), []);
    return (
      <QueryClientProvider client={queryClient}>
        <StorageObserver />
        {children}
      </QueryClientProvider>
    );
  }
  return { wrapper: Wrapper, queryClient };
}
