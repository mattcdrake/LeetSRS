import { QueryClientProvider } from '@tanstack/react-query';
/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { State } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { replaceLearningDocument } from '@/shared/storage';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createTestQueryClient } from '@/test/utils/test-wrapper';
import { useTodayReviewActivityQuery } from '../review-activity';

beforeEach(() => {
  fakeBrowser.reset();
  vi.setSystemTime(new Date('2024-03-15T12:00:00'));
});
it('uses the current popup day when a pending read completes after midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2024-03-15T23:59:55'));
  const pending = Promise.withResolvers<void>();
  const card = createMockCard(State.Review);
  const document = buildLearningDocument({
    cards: { [card.frontendId]: card },
    reviewActivity: { date: '2024-03-15', newCards: 1, streak: 3 },
  });
  await replaceLearningDocument(document);
  const get = storage.getItem.bind(storage);
  vi.spyOn(storage, 'getItem').mockImplementationOnce(async (key) => {
    const snapshot = await get(key);
    await pending.promise;
    return snapshot;
  });
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useTodayReviewActivityQuery(), { wrapper });
  try {
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    await act(async () => {
      pending.resolve();
      await vi.advanceTimersByTimeAsync(1);
    });
    await vi.waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(view.result.current.data).toBeNull();
  } finally {
    view.unmount();
    queryClient.clear();
    vi.useRealTimers();
  }
});

it('refreshes the clock when reopening a cached view after the last subscriber unmounts', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2024-03-15T23:59:55'));
  const activity = { date: '2024-03-15', newCards: 1, streak: 3 };
  await replaceLearningDocument(buildLearningDocument({ reviewActivity: activity }));
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const first = renderHook(() => useTodayReviewActivityQuery(), { wrapper });
  try {
    await act(() => vi.advanceTimersByTimeAsync(1));
    await vi.waitFor(() => expect(first.result.current.data).toEqual(activity));
    first.unmount();
    vi.setSystemTime(new Date('2024-03-16T00:00:10'));
    const reads = vi.spyOn(storage, 'getItem');
    const reopened = renderHook(() => useTodayReviewActivityQuery(), { wrapper });
    try {
      expect(reopened.result.current.data).toBeNull();
      expect(reads).not.toHaveBeenCalled();
    } finally {
      reopened.unmount();
    }
  } finally {
    first.unmount();
    queryClient.clear();
    vi.useRealTimers();
  }
});
