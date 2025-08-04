import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

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

/**
 * Creates a wrapper component with QueryClientProvider for testing
 * Each test gets its own QueryClient instance to ensure isolation
 */
export function createWrapper() {
  const testQueryClient = createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>;
  };
}

/**
 * Utility for rendering components with QueryClient in tests
 * Returns both the wrapper and the client for advanced testing scenarios
 */
export function createTestWrapper() {
  const queryClient = createTestQueryClient();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { wrapper, queryClient };
}
