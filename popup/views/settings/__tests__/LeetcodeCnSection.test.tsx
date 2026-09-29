/** @vitest-environment happy-dom */
import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { LeetcodeCnSection } from '../LeetcodeCnSection';

it('requests CN access in the click gesture and allows retry after denial', async () => {
  const mockContains = vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => false);
  const mockRequest = vi.spyOn(browser.permissions, 'request').mockImplementation(async () => false);
  render(<LeetcodeCnSection />, createPopupTestWrapper());
  const button = await screen.findByRole('button', { name: /enable/i });
  act(() => {
    button.click();
    expect(mockRequest).toHaveBeenCalledExactlyOnceWith({ origins: ['*://*.leetcode.cn/*'] });
  });
  await waitFor(() => expect(button).toBeEnabled());
  mockContains.mockImplementation(async () => true);
  mockRequest.mockImplementation(async () => true);
  act(() => button.click());
  await waitFor(() => expect(screen.queryByRole('button', { name: /enable/i })).not.toBeInTheDocument());
});
