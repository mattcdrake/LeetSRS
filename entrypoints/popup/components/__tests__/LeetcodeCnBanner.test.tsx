/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LeetcodeCnBanner } from '../LeetcodeCnBanner';

const DISMISS_KEY = 'leetsrs:leetcodeCnBannerDismissed';

const mockContains = vi.fn<() => Promise<boolean>>();
const mockRequest = vi.fn<() => Promise<boolean>>();

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
  mockContains.mockReset();
  mockRequest.mockReset();
});

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: originalLocalStorage,
    writable: true,
    configurable: true,
  });
});

describe('LeetcodeCnBanner', () => {
  it('is hidden when permission is already granted', async () => {
    mockContains.mockResolvedValue(true);

    await act(async () => {
      render(<LeetcodeCnBanner />);
    });

    expect(screen.queryByText(/leetcode\.cn/i)).not.toBeInTheDocument();
  });

  it('is hidden when dismissed via localStorage', async () => {
    mockLocalStorage.setItem(DISMISS_KEY, '1');
    mockContains.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnBanner />);
    });

    expect(screen.queryByText(/leetcode\.cn/i)).not.toBeInTheDocument();
  });

  it('is visible when not granted and not dismissed', async () => {
    mockContains.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnBanner />);
    });

    expect(screen.getByText(/leetcode\.cn/i)).toBeInTheDocument();
    expect(screen.getByText('Enable')).toBeInTheDocument();
  });

  it('requests permission and hides on success when Enable clicked', async () => {
    mockContains.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockRequest.mockResolvedValue(true);

    await act(async () => {
      render(<LeetcodeCnBanner />);
    });

    await act(async () => {
      screen.getByText('Enable').click();
    });

    expect(mockRequest).toHaveBeenCalledWith({ origins: ['*://*.leetcode.cn/*'] });
    expect(screen.queryByText(/leetcode\.cn/i)).not.toBeInTheDocument();
  });

  it('stays visible when permission request is denied', async () => {
    mockContains.mockResolvedValue(false);
    mockRequest.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnBanner />);
    });

    await act(async () => {
      screen.getByText('Enable').click();
    });

    expect(screen.getByText(/leetcode\.cn/i)).toBeInTheDocument();
  });

  it('hides and sets localStorage when dismissed', async () => {
    mockContains.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnBanner />);
    });

    await act(async () => {
      screen.getByLabelText('Dismiss').click();
    });

    expect(screen.queryByText(/leetcode\.cn/i)).not.toBeInTheDocument();
    expect(store[DISMISS_KEY]).toBe('1');
  });
});
