import { vi } from 'vitest';

/**
 * Creates a default mock for React Query query hooks
 * Represents the success state by default
 *
 * @param data - The data to return
 * @param overrides - Specific properties to override in the mock
 * @returns Mock query result object
 */
export const createQueryMock = <TData = unknown>(data: TData, overrides = {}) => ({
  data,
  error: null,
  isError: false,
  isSuccess: true,
  isLoading: false,
  isPending: false,
  isPlaceholderData: false,
  isFetching: false,
  isFetchedAfterMount: false,
  isFetched: true,
  isRefetching: false,
  isLoadingError: false,
  isRefetchError: false,
  isStale: false,
  status: 'success' as const,
  fetchStatus: 'idle' as const,
  refetch: vi.fn(),
  failureCount: 0,
  failureReason: null,
  isPaused: false,
  dataUpdatedAt: Date.now(),
  errorUpdatedAt: 0,
  isInitialLoading: false,
  errorUpdateCount: 0,
  isEnabled: true,
  promise: Promise.resolve(data),
  ...overrides,
});
