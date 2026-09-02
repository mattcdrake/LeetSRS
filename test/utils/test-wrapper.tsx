import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';

/**
 * Creates a new QueryClient with test-friendly defaults
 * - Turns off retries to prevent test timeouts
 * - Disables refetch on window focus
 * - Sets stale time to 0 for predictable behavior
 */
export function createTestQueryClient() {
  return new QueryClient({
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

function TestQueryClientProvider({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  useEffect(() => () => queryClient.clear(), [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/**
 * Creates a QueryClient and provider wrapper for a test.
 * Call this inside each test or `beforeEach` to avoid sharing cached state.
 * The client is cleared when the wrapper unmounts.
 */
export function createTestWrapper() {
  const queryClient = createTestQueryClient();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestQueryClientProvider queryClient={queryClient}>{children}</TestQueryClientProvider>
  );

  return { wrapper, queryClient };
}
