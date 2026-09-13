/**
 * @vitest-environment happy-dom
 */

import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useLeetcodeCnCapability } from '../leetcode-cn';

it('checks and requests permissions while offline', async () => {
  const wasOnline = onlineManager.isOnline();
  onlineManager.setOnline(false);
  try {
    const contains = vi.fn(async () => false);
    vi.spyOn(browser.permissions, 'contains').mockImplementation(contains);
    const request = vi.fn(async () => true);
    vi.spyOn(browser.permissions, 'request').mockImplementation(request);
    const { wrapper } = createPopupTestWrapper();
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
  const { wrapper } = createPopupTestWrapper();
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
  const { wrapper } = createPopupTestWrapper();
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

it('tracks request failures and allows retrying without losing the user interaction', async () => {
  const contains = vi.fn(async () => false);
  vi.spyOn(browser.permissions, 'contains').mockImplementation(contains);
  const pending = Promise.withResolvers<boolean>();
  const request = vi.fn(() => pending.promise);
  vi.spyOn(browser.permissions, 'request').mockImplementation(request);
  const { wrapper } = createPopupTestWrapper();
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
  const { wrapper } = createPopupTestWrapper();
  const { result } = renderHook(() => useLeetcodeCnCapability(), { wrapper });
  await waitFor(() => expect(result.current.granted).toBe(false));
  await act(() => result.current.enable());
  expect(result.current.granted).toBe(false);
});
