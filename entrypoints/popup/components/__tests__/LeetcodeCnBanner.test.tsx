/**
 * @vitest-environment happy-dom
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { useLeetcodeCnPermissionEvents } from '../../queries/leetcode-cn';
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
  it.each([
    { buttonIndex: 0, granted: true },
    { buttonIndex: 1, granted: true },
    { buttonIndex: 0, granted: false },
    { buttonIndex: 1, granted: false },
  ])('shares granted=$granted after Enable button $buttonIndex is clicked', async ({ buttonIndex, granted }) => {
    const request = Promise.withResolvers<boolean>();
    mockRequest.mockReturnValue(request.promise);
    render(
      <>
        <LeetcodeCnBanner />
        <LeetcodeCnSection />
      </>,
      createTestWrapper()
    );
    await waitFor(() => expect(screen.getAllByRole('button', { name: /enable/i })).toHaveLength(2));
    expect(mockRequest).not.toHaveBeenCalled();
    const button = screen.getAllByRole('button', { name: /enable/i })[buttonIndex];
    act(() => {
      button.click();
      expect(mockRequest).toHaveBeenCalledExactlyOnceWith({ origins: ['*://*.leetcode.cn/*'] });
    });
    await waitFor(() => expect(button).toBeDisabled());
    mockContains.mockResolvedValue(granted);
    await act(async () => request.resolve(granted));
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /enable/i })).toHaveLength(granted ? 0 : 2));
    if (!granted) {
      await waitFor(() => expect(button).toBeEnabled());
      mockRequest.mockResolvedValue(true);
      mockContains.mockResolvedValue(true);
      act(() => button.click());
      await waitFor(() => expect(screen.queryAllByRole('button', { name: /enable/i })).toHaveLength(0));
    }
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

  it.each([true, false])('preserves dismissed=%s across reopenings and permission events', async (dismissed) => {
    const added = vi.spyOn(browser.permissions.onAdded, 'addListener').mockImplementation(() => {});
    const removed = vi.spyOn(browser.permissions.onRemoved, 'addListener').mockImplementation(() => {});
    vi.spyOn(browser.permissions.onAdded, 'removeListener').mockImplementation(() => {});
    vi.spyOn(browser.permissions.onRemoved, 'removeListener').mockImplementation(() => {});
    const removePermission = vi.spyOn(browser.permissions, 'remove');
    function PermissionObserver() {
      useLeetcodeCnPermissionEvents();
      return null;
    }
    const openPopup = () =>
      render(
        <>
          <PermissionObserver />
          <LeetcodeCnBanner />
          <LeetcodeCnSection />
        </>,
        createTestWrapper()
      );

    const popup = openPopup();
    const dismiss = await screen.findByRole('button', { name: 'Dismiss' });
    if (dismissed) act(() => dismiss.click());
    popup.unmount();

    openPopup();
    expect(await screen.findByText('LeetCode China')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Dismiss' })).toHaveLength(dismissed ? 0 : 1);

    mockContains.mockResolvedValue(true);
    await act(async () => added.mock.calls[1][0]({ origins: ['*://*.leetcode.cn/*'] }));
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /enable/i })).toHaveLength(0));

    mockContains.mockResolvedValue(false);
    await act(async () => removed.mock.calls[1][0]({ origins: ['*://*.leetcode.cn/*'] }));
    expect(await screen.findByText('LeetCode China')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /enable/i });
    expect(buttons).toHaveLength(dismissed ? 1 : 2);
    for (const button of buttons) expect(button).toBeEnabled();
    expect(screen.queryAllByRole('button', { name: 'Dismiss' })).toHaveLength(dismissed ? 0 : 1);
    expect(store[DISMISS_KEY]).toBe(dismissed ? '1' : undefined);
    expect(mockRequest).not.toHaveBeenCalled();
    expect(removePermission).not.toHaveBeenCalled();
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
    const permission = Promise.withResolvers<boolean>();
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
