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

/**
 * Creates a default mock for React Query mutation hooks
 * Represents the idle state by default
 *
 * @param overrides - Specific properties to override in the mock
 * @returns Mock mutation result object
 */
export const createMutationMock = (overrides = {}) => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  isIdle: true,
  isSuccess: false,
  data: undefined,
  error: null,
  reset: vi.fn(),
  status: 'idle' as const,
  variables: undefined,
  context: undefined,
  failureCount: 0,
  failureReason: null,
  isPaused: false,
  submittedAt: 0,
  ...overrides,
});

/**
 * Creates a mock for a pending mutation
 */
export const createPendingMutationMock = (overrides = {}) =>
  createMutationMock({
    isPending: true,
    isIdle: false,
    status: 'pending',
    ...overrides,
  });

/**
 * Creates a mock for a successful mutation
 */
export const createSuccessMutationMock = <TData = unknown>(data: TData, overrides = {}) =>
  createMutationMock({
    isSuccess: true,
    isIdle: false,
    status: 'success',
    data,
    ...overrides,
  });

/**
 * Creates a mock for a failed mutation
 */
export const createErrorMutationMock = (error: Error, overrides = {}) =>
  createMutationMock({
    isError: true,
    isIdle: false,
    status: 'error',
    error,
    failureReason: error,
    ...overrides,
  });
