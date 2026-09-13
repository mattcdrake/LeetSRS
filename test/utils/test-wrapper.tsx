import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { useStorageQueryEvents } from '@/popup/queries/storage-events';
import { createPopupQueryClient } from '@/popup/query-client';

/**
 * Creates a new QueryClient with test-friendly defaults
 * - Turns off retries to prevent test timeouts
 * - Disables refetch on window focus
 * - Sets stale time to 0 for predictable behavior
 */
export function createTestQueryClient() {
  return createPopupQueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function StorageObserver() {
  useStorageQueryEvents();
  return null;
}

function TestQueryClientProvider({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  useEffect(() => () => queryClient.clear(), [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function PopupTestQueryClientProvider({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  return (
    <TestQueryClientProvider queryClient={queryClient}>
      <StorageObserver />
      {children}
    </TestQueryClientProvider>
  );
}

function createTestWrapperWithProvider(
  Provider: ({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) => ReactNode
) {
  const queryClient = createTestQueryClient();

  const wrapper = ({ children }: { children: ReactNode }) => <Provider queryClient={queryClient}>{children}</Provider>;

  return { wrapper, queryClient };
}

/**
 * Creates a QueryClient and provider wrapper for a test.
 * Call this inside each test or `beforeEach` to avoid sharing cached state.
 * The client is cleared when the wrapper unmounts.
 */
export function createTestWrapper() {
  return createTestWrapperWithProvider(TestQueryClientProvider);
}

/**
 * Creates the popup integration wrapper with storage event observation.
 */
export function createPopupTestWrapper() {
  return createTestWrapperWithProvider(PopupTestQueryClientProvider);
}
