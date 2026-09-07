/**
 * @vitest-environment happy-dom
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeferred } from '@/test/utils/deferred';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { LeetcodeCnSection } from '../LeetcodeCnSection';

const mockContains = vi.fn<() => Promise<boolean>>();
const mockRequest = vi.fn<() => Promise<boolean>>();

beforeEach(() => {
  browser.permissions.contains = mockContains;
  browser.permissions.request = mockRequest;
  mockContains.mockReset();
  mockContains.mockResolvedValue(false);
  mockRequest.mockReset();
});

describe('LeetcodeCnSection', () => {
  it('hides the prompt until permission has loaded', async () => {
    const permission = createDeferred<boolean>();
    mockContains.mockReturnValue(permission.promise);
    render(<LeetcodeCnSection />, createTestWrapper());
    expect(screen.queryByText('LeetCode China')).not.toBeInTheDocument();
    await act(async () => permission.resolve(false));
    expect(await screen.findByText('LeetCode China')).toBeInTheDocument();
  });

  it('renders nothing when permission already granted', async () => {
    mockContains.mockResolvedValue(true);

    await act(async () => {
      render(<LeetcodeCnSection />, createTestWrapper());
    });

    expect(screen.queryByText('LeetCode China')).not.toBeInTheDocument();
  });

  it('renders enable button when permission not granted', async () => {
    mockContains.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnSection />, createTestWrapper());
    });

    expect(await screen.findByText('LeetCode China')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable/i })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('requests permission and hides when Enable clicked', async () => {
    mockContains.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockRequest.mockResolvedValue(true);

    await act(async () => {
      render(<LeetcodeCnSection />, createTestWrapper());
    });

    await act(async () => {
      (await screen.findByRole('button', { name: /enable/i })).click();
    });

    expect(mockRequest).toHaveBeenCalledWith({ origins: ['*://*.leetcode.cn/*'] });
    await waitFor(() => expect(screen.queryByText('LeetCode China')).not.toBeInTheDocument());
  });

  it('stays visible when user denies the permission prompt', async () => {
    mockContains.mockResolvedValue(false);
    mockRequest.mockResolvedValue(false);

    await act(async () => {
      render(<LeetcodeCnSection />, createTestWrapper());
    });

    await act(async () => {
      (await screen.findByRole('button', { name: /enable/i })).click();
    });

    expect(mockRequest).toHaveBeenCalled();
    expect(await screen.findByText('LeetCode China')).toBeInTheDocument();
  });
});
