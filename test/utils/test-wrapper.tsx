import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';

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
 * Creates a wrapper component with QueryClientProvider for testing
 * Each test gets its own QueryClient instance to ensure isolation
 */
export function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    // The client belongs to this mounted render and is cleared on unmount.
    const [queryClient] = useState(createTestQueryClient);

    return <TestQueryClientProvider queryClient={queryClient}>{children}</TestQueryClientProvider>;
  };
}

/**
 * Utility for rendering components with QueryClient in tests
 * Returns both the wrapper and the client for advanced testing scenarios
 * Create it inside each test or `beforeEach`; the explicit client is shared by
 * every render that uses the returned wrapper until those renders unmount.
 */
export function createTestWrapper() {
  const queryClient = createTestQueryClient();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestQueryClientProvider queryClient={queryClient}>{children}</TestQueryClientProvider>
  );

  return { wrapper, queryClient };
}
