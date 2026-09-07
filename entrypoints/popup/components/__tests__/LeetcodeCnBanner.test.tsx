/**
 * @vitest-environment happy-dom
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeferred } from '@/test/utils/deferred';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { LeetcodeCnSection } from '../../views/settings/LeetcodeCnSection';
import { DISMISS_KEY, LeetcodeCnBanner } from '../LeetcodeCnBanner';

const mockContains = vi.fn<() => Promise<boolean>>();
const mockRequest = vi.fn<() => Promise<boolean>>();
type QueriedTabs = Parameters<Parameters<typeof browser.tabs.query>[1]>[0];
const mockQuery = vi.fn<() => Promise<QueriedTabs>>();
const tabWithUrl = (url?: string) => ({ url }) as QueriedTabs[number];

// Mock localStorage since WXT test env doesn't provide one
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) delete store[key];
  },
  length: 0,
  key: () => null,
};

const originalLocalStorage = globalThis.localStorage;

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });
  mockLocalStorage.clear();
  browser.permissions.contains = mockContains;
  browser.permissions.request = mockRequest;
  browser.tabs.query = mockQuery as typeof browser.tabs.query;
  mockContains.mockReset();
  mockContains.mockResolvedValue(false);
  mockRequest.mockReset();
  mockQuery.mockReset();
  mockQuery.mockResolvedValue([tabWithUrl('https://leetcode.cn/problems/two-sum/')]);
});

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: originalLocalStorage,
    writable: true,
    configurable: true,
  });
});

describe('LeetcodeCnBanner', () => {
  it.each([0, 1])('updates both consumers when Enable button %s grants permission', async (buttonIndex) => {
    const request = createDeferred<boolean>();
    mockRequest.mockReturnValue(request.promise);
    render(
      <>
        <LeetcodeCnBanner />
        <LeetcodeCnSection />
      </>,
      createTestWrapper()
    );
    await waitFor(() => expect(screen.getAllByRole('button', { name: /enable/i })).toHaveLength(2));
    const button = screen.getAllByRole('button', { name: /enable/i })[buttonIndex];
    act(() => {
      button.click();
      expect(mockRequest).toHaveBeenCalledExactlyOnceWith({ origins: ['*://*.leetcode.cn/*'] });
    });
    await waitFor(() => expect(button).toBeDisabled());
    mockContains.mockResolvedValue(true);
    await act(async () => request.resolve(true));
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /enable/i })).toHaveLength(0));
  });

  it('keeps settings available after dismissing the banner', async () => {
    render(
      <>
        <LeetcodeCnBanner />
        <LeetcodeCnSection />
      </>,
      createTestWrapper()
    );
    const dismiss = await screen.findByRole('button', { name: 'Dismiss' });
    act(() => dismiss.click());
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(screen.getByText('LeetCode China')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable/i })).toBeEnabled();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it.each([
    { context: 'a leetcode.com tab', tabs: [tabWithUrl('https://leetcode.com/problems/two-sum/')] },
    { context: 'an unrelated tab', tabs: [tabWithUrl('https://example.com/')] },
    { context: 'a tab without a URL', tabs: [tabWithUrl()] },
    { context: 'an invalid tab URL', tabs: [tabWithUrl('not-a-url')] },
    { context: 'no active tab', tabs: [] },
  ])('is hidden for $context', async ({ tabs }) => {
    mockQuery.mockResolvedValue(tabs);

    await act(async () => {
      render(<LeetcodeCnBanner />, createTestWrapper());
    });

    expect(mockQuery).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(mockRequest).not.toHaveBeenCalled();
    expect(screen.queryByText(/leetcode\.cn/i)).not.toBeInTheDocument();
  });

  it('hides the prompt until permission has loaded', async () => {
    const permission = createDeferred<boolean>();
    mockContains.mockReturnValue(permission.promise);
    render(<LeetcodeCnBanner />, createTestWrapper());
    expect(screen.queryByText(/leetcode\.cn/i)).not.toBeInTheDocument();
    await act(async () => permission.resolve(false));
    expect(await screen.findByText(/leetcode\.cn/i)).toBeInTheDocument();
  });

  it('is hidden when permission is already granted', async () => {
    mockContains.mockResolvedValue(true);

    await act(async () => {
      render(<LeetcodeCnBanner />, createTestWrapper());
    });

    expect(screen.queryByText(/leetcode\.cn/i)).not.toBeInTheDocument();
  });

  it('is hidden when dismissed via localStorage', async () => {
    mockLocalStorage.setItem(DISMISS_KEY, '1');
    mockContains.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnBanner />, createTestWrapper());
    });

    expect(screen.queryByText(/leetcode\.cn/i)).not.toBeInTheDocument();
  });

  it('is visible when not granted and not dismissed', async () => {
    mockContains.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnBanner />, createTestWrapper());
    });

    expect(await screen.findByText(/leetcode\.cn/i)).toBeInTheDocument();
    expect(await screen.findByText('Enable')).toBeInTheDocument();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('requests permission and hides on success when Enable clicked', async () => {
    mockContains.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockRequest.mockResolvedValue(true);

    await act(async () => {
      render(<LeetcodeCnBanner />, createTestWrapper());
    });

    await act(async () => {
      (await screen.findByText('Enable')).click();
    });

    expect(mockRequest).toHaveBeenCalledWith({ origins: ['*://*.leetcode.cn/*'] });
    await waitFor(() => expect(screen.queryByText(/leetcode\.cn/i)).not.toBeInTheDocument());
  });

  it('stays visible when permission request is denied', async () => {
    mockContains.mockResolvedValue(false);
    mockRequest.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnBanner />, createTestWrapper());
    });

    await act(async () => {
      (await screen.findByText('Enable')).click();
    });

    expect(await screen.findByText(/leetcode\.cn/i)).toBeInTheDocument();
  });

  it('hides and sets localStorage when dismissed', async () => {
    mockContains.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnBanner />, createTestWrapper());
    });

    await act(async () => {
      (await screen.findByLabelText('Dismiss')).click();
    });

    expect(screen.queryByText(/leetcode\.cn/i)).not.toBeInTheDocument();
    expect(store[DISMISS_KEY]).toBe('1');
  });
});
