/**
 * @vitest-environment happy-dom
 */

import { onlineManager } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { LeetcodeCnSection } from '../../views/settings/LeetcodeCnSection';
import { LeetcodeCnBanner } from '../LeetcodeCnBanner';

const mockContains = vi.fn<() => Promise<boolean>>();
const mockRequest = vi.fn<() => Promise<boolean>>();
type QueriedTabs = Parameters<Parameters<typeof browser.tabs.query>[1]>[0];
const mockQuery = vi.fn<() => Promise<QueriedTabs>>();
const tabWithUrl = (url?: string) => ({ url }) as QueriedTabs[number];

beforeEach(() => {
  localStorage.clear();
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
  onlineManager.setOnline(true);
});

describe('LeetcodeCnBanner', () => {
  it('persists banner dismissal and keeps settings available', async () => {
    const content = (
      <>
        <LeetcodeCnBanner />
        <LeetcodeCnSection />
      </>
    );
    const view = render(content, createPopupTestWrapper());
    const dismiss = await screen.findByRole('button', { name: 'Dismiss' });
    act(() => dismiss.click());
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(screen.queryByText('Using leetcode.cn? Enable support to add problems.')).not.toBeInTheDocument();
    expect(screen.getByText('leetcode.cn (力扣) support')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable/i })).toBeEnabled();
    expect(mockRequest).not.toHaveBeenCalled();

    view.unmount();
    render(content, createPopupTestWrapper());
    expect(await screen.findByRole('button', { name: /enable/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(screen.queryByText('Using leetcode.cn? Enable support to add problems.')).not.toBeInTheDocument();
  });

  it.each([
    { context: 'a leetcode.com tab', tabs: [tabWithUrl('https://leetcode.com/problems/two-sum/')] },
    { context: 'no active tab', tabs: [] },
    { context: 'a lookalike domain', tabs: [tabWithUrl('https://leetcode.cn.example.com/')] },
  ])('is hidden for $context', async ({ tabs }) => {
    mockQuery.mockResolvedValue(tabs);

    await act(async () => {
      render(<LeetcodeCnBanner />, createPopupTestWrapper());
    });

    expect(mockQuery).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(mockRequest).not.toHaveBeenCalled();
    expect(screen.queryByText(/leetcode\.cn/i)).not.toBeInTheDocument();
  });
});

it.each(['offline', 'denied', 'rejected', 'not-authorized'])(
  'enables through the UI after %s permission handling',
  async (scenario) => {
    if (scenario === 'offline') onlineManager.setOnline(false);
    const pending = Promise.withResolvers<boolean>();
    mockRequest.mockReturnValueOnce(pending.promise);
    render(
      <>
        <LeetcodeCnBanner />
        <LeetcodeCnSection />
      </>,
      createPopupTestWrapper()
    );
    await waitFor(() => expect(screen.getAllByRole('button', { name: /enable/i })).toHaveLength(2));
    expect(mockRequest).not.toHaveBeenCalled();
    const button = screen.getAllByRole('button', { name: /enable/i })[scenario === 'denied' ? 1 : 0];
    act(() => {
      button.click();
      expect(mockRequest).toHaveBeenCalledExactlyOnceWith({ origins: ['*://*.leetcode.cn/*'] });
    });
    await waitFor(() => expect(button).toBeDisabled());
    if (scenario === 'offline') mockContains.mockResolvedValue(true);
    await act(async () => {
      if (scenario === 'rejected') pending.reject(new Error('User gesture required'));
      else pending.resolve(scenario !== 'denied');
    });
    if (scenario !== 'offline') {
      await waitFor(() => expect(button).toBeEnabled());
      expect(screen.getAllByRole('button', { name: /enable/i })).toHaveLength(2);
      mockContains.mockResolvedValue(true);
      mockRequest.mockResolvedValue(true);
      act(() => {
        button.click();
        expect(mockRequest).toHaveBeenCalledTimes(2);
      });
    }
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /enable/i })).toHaveLength(0));
  }
);
