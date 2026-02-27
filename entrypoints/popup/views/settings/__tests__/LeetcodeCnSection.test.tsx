/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LeetcodeCnSection } from '../LeetcodeCnSection';

const mockContains = vi.fn<() => Promise<boolean>>();
const mockRequest = vi.fn<() => Promise<boolean>>();

beforeEach(() => {
  browser.permissions.contains = mockContains;
  browser.permissions.request = mockRequest;
  mockContains.mockReset();
  mockRequest.mockReset();
});

describe('LeetcodeCnSection', () => {
  it('renders nothing when permission already granted', async () => {
    mockContains.mockResolvedValue(true);

    await act(async () => {
      render(<LeetcodeCnSection />);
    });

    expect(screen.queryByText('LeetCode China')).not.toBeInTheDocument();
  });

  it('renders enable button when permission not granted', async () => {
    mockContains.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnSection />);
    });

    expect(screen.getByText('LeetCode China')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable/i })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('requests permission and hides when Enable clicked', async () => {
    mockContains.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockRequest.mockResolvedValue(true);

    await act(async () => {
      render(<LeetcodeCnSection />);
    });

    await act(async () => {
      screen.getByRole('button', { name: /enable/i }).click();
    });

    expect(mockRequest).toHaveBeenCalledWith({ origins: ['*://*.leetcode.cn/*'] });
    expect(screen.queryByText('LeetCode China')).not.toBeInTheDocument();
  });

  it('stays visible when user denies the permission prompt', async () => {
    mockContains.mockResolvedValue(false);
    mockRequest.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnSection />);
    });

    await act(async () => {
      screen.getByRole('button', { name: /enable/i }).click();
    });

    expect(mockRequest).toHaveBeenCalled();
    expect(screen.getByText('LeetCode China')).toBeInTheDocument();
  });
});
