/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { createDeferred } from '@/test/utils/deferred';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { useLeetcodeCnCapability } from '../leetcode-cn';

it.each([true, false])('loads shared permission state: %s', async (granted) => {
  const check = createDeferred<boolean>();
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
  vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => false);
  const request = vi.fn(async () => granted);
  vi.spyOn(browser.permissions, 'request').mockImplementation(request);
  const { wrapper } = createTestWrapper();
  const { result } = renderHook(() => [useLeetcodeCnCapability(), useLeetcodeCnCapability()], { wrapper });
  await waitFor(() => expect(result.current[0].granted).toBe(false));

  await act(async () => {
    const enabling = result.current[0].enable();
    expect(request).toHaveBeenCalledExactlyOnceWith({ origins: ['*://*.leetcode.cn/*'] });
    expect(await enabling).toBe(granted);
  });

  await waitFor(() => {
    expect(result.current.map((capability) => capability.granted)).toEqual([granted, granted]);
  });

  if (!granted) {
    request.mockResolvedValue(true);
    await act(() => result.current[1].enable());
    await waitFor(() => {
      expect(result.current.map((capability) => capability.granted)).toEqual([true, true]);
    });
  }
});
