/**
 * @vitest-environment happy-dom
 */

import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { createTestQueryClient, createTestWrapper } from '@/test/utils/test-wrapper';
import { useLeetcodeCnCapability, useLeetcodeCnPermissionEvents } from '../leetcode-cn';

beforeEach(() => {
  for (const event of [browser.permissions.onAdded, browser.permissions.onRemoved]) {
    vi.spyOn(event, 'addListener').mockImplementation(() => {});
    vi.spyOn(event, 'removeListener').mockImplementation(() => {});
  }
});

it('checks and requests permissions while offline', async () => {
  const wasOnline = onlineManager.isOnline();
  onlineManager.setOnline(false);
  try {
    const contains = vi.fn(async () => false);
    vi.spyOn(browser.permissions, 'contains').mockImplementation(contains);
    const request = vi.fn(async () => true);
    vi.spyOn(browser.permissions, 'request').mockImplementation(request);
    const { wrapper } = createTestWrapper();
    const { result, unmount } = renderHook(() => useLeetcodeCnCapability(), { wrapper });

    await waitFor(() => expect(result.current.granted).toBe(false));
    expect(result.current.isLoading).toBe(false);
    contains.mockResolvedValue(true);
    act(() => result.current.enable());
    expect(request).toHaveBeenCalledExactlyOnceWith({ origins: ['*://*.leetcode.cn/*'] });
    await waitFor(() => expect(result.current.granted).toBe(true));
    await waitFor(() => expect(result.current.isEnabling).toBe(false));
    unmount();
  } finally {
    onlineManager.setOnline(wasOnline);
  }
});

it.each([true, false])('loads shared permission state: %s', async (granted) => {
  const check = Promise.withResolvers<boolean>();
  const contains = vi.fn(() => check.promise);
  vi.spyOn(browser.permissions, 'contains').mockImplementation(contains);
  const request = vi.spyOn(browser.permissions, 'request');
  const { wrapper } = createTestWrapper();
  const { result } = renderHook(() => [useLeetcodeCnCapability(), useLeetcodeCnCapability()], { wrapper });

  for (const capability of result.current) {
    expect(capability.granted).toBeNull();
    expect(capability.isLoading).toBe(true);
  }
  expect(contains).toHaveBeenCalledExactlyOnceWith({ origins: ['*://*.leetcode.cn/*'] });
  expect(request).not.toHaveBeenCalled();

  await act(async () => check.resolve(granted));
  await waitFor(() => {
    for (const capability of result.current) {
      expect(capability.granted).toBe(granted);
      expect(capability.isLoading).toBe(false);
    }
  });
});

it.each([true, false])('shares the enable result across consumers: %s', async (granted) => {
  const contains = vi.fn(async () => false);
  vi.spyOn(browser.permissions, 'contains').mockImplementation(contains);
  const request = vi.fn(async () => granted);
  vi.spyOn(browser.permissions, 'request').mockImplementation(request);
  const { wrapper } = createTestWrapper();
  const { result } = renderHook(() => [useLeetcodeCnCapability(), useLeetcodeCnCapability()], { wrapper });
  await waitFor(() => expect(result.current[0].granted).toBe(false));

  await act(async () => {
    contains.mockResolvedValue(granted);
    expect(result.current[0].enable()).toBeUndefined();
    expect(request).toHaveBeenCalledExactlyOnceWith({ origins: ['*://*.leetcode.cn/*'] });
  });

  await waitFor(() => {
    expect(result.current.map((capability) => capability.granted)).toEqual([granted, granted]);
  });

  if (!granted) {
    request.mockResolvedValue(true);
    contains.mockResolvedValue(true);
    await act(() => result.current[1].enable());
    await waitFor(() => {
      expect(result.current.map((capability) => capability.granted)).toEqual([true, true]);
    });
  }
});

it('refreshes both consumers on external grants and removals', async () => {
  const contains = vi.fn(async () => false);
  vi.spyOn(browser.permissions, 'contains').mockImplementation(contains);
  const added = vi.spyOn(browser.permissions.onAdded, 'addListener');
  const removed = vi.spyOn(browser.permissions.onRemoved, 'addListener');
  const { wrapper: QueryWrapper } = createTestWrapper();
  function PermissionObserver() {
    useLeetcodeCnPermissionEvents();
    return null;
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryWrapper>
      <PermissionObserver />
      {children}
    </QueryWrapper>
  );
  const { result } = renderHook(() => [useLeetcodeCnCapability(), useLeetcodeCnCapability()], { wrapper });
  await waitFor(() => expect(result.current.map((state) => state.granted)).toEqual([false, false]));
  expect(added).toHaveBeenCalledTimes(1);
  expect(removed).toHaveBeenCalledTimes(1);

  await act(async () => added.mock.calls[0][0]({ permissions: ['storage'] }));
  expect(contains).toHaveBeenCalledTimes(1);

  contains.mockResolvedValue(true);
  // Broad permission changes also require checking the effective authorization.
  await act(async () => added.mock.calls[0][0]({ origins: ['<all_urls>'] }));
  await waitFor(() => expect(result.current.map((state) => state.granted)).toEqual([true, true]));

  contains.mockResolvedValue(false);
  await act(async () => removed.mock.calls[0][0]({ origins: ['*://*.leetcode.cn/*'] }));
  await waitFor(() => expect(result.current.map((state) => state.granted)).toEqual([false, false]));
});

it('tracks request failures and allows retrying without losing the user interaction', async () => {
  const contains = vi.fn(async () => false);
  vi.spyOn(browser.permissions, 'contains').mockImplementation(contains);
  const pending = Promise.withResolvers<boolean>();
  const request = vi.fn(() => pending.promise);
  vi.spyOn(browser.permissions, 'request').mockImplementation(request);
  const { wrapper } = createTestWrapper();
  const { result } = renderHook(() => useLeetcodeCnCapability(), { wrapper });
  await waitFor(() => expect(result.current.granted).toBe(false));

  const failure = new Error('User gesture required');
  await act(async () => {
    expect(result.current.enable()).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
  });
  await waitFor(() => expect(result.current.isEnabling).toBe(true));
  await act(async () => {
    pending.reject(failure);
  });
  await waitFor(() => expect(result.current.enableError).toBe(failure));
  expect(result.current.isEnabling).toBe(false);
  expect(result.current.granted).toBe(false);

  request.mockResolvedValue(true);
  contains.mockResolvedValue(true);
  await act(() => result.current.enable());
  await waitFor(() => expect(result.current.granted).toBe(true));
  expect(result.current.enableError).toBeNull();
});

it('rechecks browser authorization after a request instead of caching its result', async () => {
  vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => false);
  vi.spyOn(browser.permissions, 'request').mockImplementation(async () => true);
  const { wrapper } = createTestWrapper();
  const { result } = renderHook(() => useLeetcodeCnCapability(), { wrapper });
  await waitFor(() => expect(result.current.granted).toBe(false));
  await act(() => result.current.enable());
  expect(result.current.granted).toBe(false);
});

it.each(['initial', 'refresh'])('discards a stale %s check after a newer permission event', async (phase) => {
  const stale = Promise.withResolvers<boolean>();
  const contains = vi.fn(async () => false);
  contains.mockImplementationOnce(() => (phase === 'initial' ? stale.promise : Promise.resolve(false)));
  vi.spyOn(browser.permissions, 'contains').mockImplementation(contains);
  const added = vi.spyOn(browser.permissions.onAdded, 'addListener');
  const removed = vi.spyOn(browser.permissions.onRemoved, 'addListener');
  const { wrapper: QueryWrapper } = createTestWrapper();
  function PermissionObserver() {
    useLeetcodeCnPermissionEvents();
    return null;
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryWrapper>
      <PermissionObserver />
      {children}
    </QueryWrapper>
  );
  const { result } = renderHook(() => useLeetcodeCnCapability(), { wrapper });

  if (phase === 'refresh') {
    await waitFor(() => expect(result.current.granted).toBe(false));
    contains.mockImplementationOnce(() => stale.promise);
    await act(async () => {
      added.mock.calls[0][0]({ origins: ['*://*.leetcode.cn/*'] });
    });
    await waitFor(() => expect(contains).toHaveBeenCalledTimes(2));
  }

  contains.mockResolvedValue(false);
  await act(async () => removed.mock.calls[0][0]({ origins: ['*://*.leetcode.cn/*'] }));
  await waitFor(() => expect(result.current.granted).toBe(false));
  await act(async () => stale.resolve(true));
  expect(result.current.granted).toBe(false);
});

it('owns listeners at the popup root across consumer unmounts and refreshes on remount', async () => {
  const contains = vi.fn(async () => false);
  vi.spyOn(browser.permissions, 'contains').mockImplementation(contains);
  const added = vi.spyOn(browser.permissions.onAdded, 'addListener');
  const removed = vi.spyOn(browser.permissions.onRemoved, 'addListener');
  const removeAdded = vi.spyOn(browser.permissions.onAdded, 'removeListener');
  const removeRemoved = vi.spyOn(browser.permissions.onRemoved, 'removeListener');
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({ queries: { staleTime: Infinity, retry: false } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const root = renderHook(() => useLeetcodeCnPermissionEvents(), { wrapper });
  const first = renderHook(() => useLeetcodeCnCapability(), { wrapper });
  const second = renderHook(() => useLeetcodeCnCapability(), { wrapper });
  await waitFor(() => expect(second.result.current.granted).toBe(false));

  first.unmount();
  expect(removeAdded).not.toHaveBeenCalled();
  expect(removeRemoved).not.toHaveBeenCalled();

  const pending = Promise.withResolvers<boolean>();
  contains.mockImplementationOnce(() => pending.promise);
  await act(async () => {
    added.mock.calls[0][0]({ origins: ['*://*.leetcode.cn/*'] });
  });
  await waitFor(() => expect(contains).toHaveBeenCalledTimes(2));
  second.unmount();
  expect(removeAdded).not.toHaveBeenCalled();
  expect(removeRemoved).not.toHaveBeenCalled();
  root.unmount();
  expect(removeAdded).toHaveBeenCalledExactlyOnceWith(added.mock.calls[0][0]);
  expect(removeRemoved).toHaveBeenCalledExactlyOnceWith(removed.mock.calls[0][0]);

  // The browser check can finish while no consumers are mounted.
  await act(async () => pending.resolve(false));
  contains.mockResolvedValue(true);
  const reopenedRoot = renderHook(() => useLeetcodeCnPermissionEvents(), { wrapper });
  const reopened = renderHook(() => useLeetcodeCnCapability(), { wrapper });
  await waitFor(() => expect(reopened.result.current.granted).toBe(true));
  expect(added).toHaveBeenCalledTimes(2);
  expect(removed).toHaveBeenCalledTimes(2);
  reopened.unmount();
  reopenedRoot.unmount();
  queryClient.clear();
});

it('finishes refreshing if the permission listener unmounts during cancellation', async () => {
  const contains = vi.fn(async () => false);
  vi.spyOn(browser.permissions, 'contains').mockImplementation(contains);
  const added = vi.spyOn(browser.permissions.onAdded, 'addListener');
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const root = renderHook(() => useLeetcodeCnPermissionEvents(), { wrapper });
  const consumer = renderHook(() => useLeetcodeCnCapability(), { wrapper });
  await waitFor(() => expect(consumer.result.current.granted).toBe(false));

  const cancellation = Promise.withResolvers<void>();
  const cancelQueries = queryClient.cancelQueries.bind(queryClient);
  vi.spyOn(queryClient, 'cancelQueries').mockImplementation(async (filters) => {
    await cancelQueries(filters);
    await cancellation.promise;
  });
  contains.mockResolvedValue(true);
  await act(async () => {
    added.mock.calls[0][0]({ origins: ['*://*.leetcode.cn/*'] });
  });
  root.unmount();
  await act(async () => cancellation.resolve());
  await waitFor(() => expect(consumer.result.current.granted).toBe(true));
  consumer.unmount();
  queryClient.clear();
});
