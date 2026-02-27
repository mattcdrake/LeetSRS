/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LeetcodeCnSection } from '../LeetcodeCnSection';

const mockContains = vi.fn<() => Promise<boolean>>();
const mockRequest = vi.fn<() => Promise<boolean>>();
const mockRemove = vi.fn<() => Promise<boolean>>();

beforeEach(() => {
  browser.permissions.contains = mockContains;
  browser.permissions.request = mockRequest;
  browser.permissions.remove = mockRemove;
});

describe('LeetcodeCnSection', () => {
  it('renders with toggle off when permission not granted', async () => {
    mockContains.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnSection />);
    });

    expect(screen.getByText('LeetCode China')).toBeInTheDocument();
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('renders with toggle on when permission already granted', async () => {
    mockContains.mockResolvedValue(true);

    await act(async () => {
      render(<LeetcodeCnSection />);
    });

    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('calls permissions.request when toggled on', async () => {
    mockContains.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockRequest.mockResolvedValue(true);

    await act(async () => {
      render(<LeetcodeCnSection />);
    });

    await act(async () => {
      screen.getByRole('switch').click();
    });

    expect(mockRequest).toHaveBeenCalledWith({ origins: ['*://*.leetcode.cn/*'] });
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('calls permissions.remove when toggled off', async () => {
    mockContains.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockRemove.mockResolvedValue(true);

    await act(async () => {
      render(<LeetcodeCnSection />);
    });

    await act(async () => {
      screen.getByRole('switch').click();
    });

    expect(mockRemove).toHaveBeenCalledWith({ origins: ['*://*.leetcode.cn/*'] });
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('handles user denying the permission prompt', async () => {
    // Initially off, user denies so still off after re-check
    mockContains.mockResolvedValue(false);
    mockRequest.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnSection />);
    });

    await act(async () => {
      screen.getByRole('switch').click();
    });

    expect(mockRequest).toHaveBeenCalled();
    expect(screen.getByRole('switch')).not.toBeChecked();
  });
});
