/** @vitest-environment happy-dom */
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { replaceLearningDocument } from '@/shared/storage';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createTestQueryClient } from '@/test/utils/test-wrapper';
import { useTodayReviewActivityQuery } from '../review-activity';

it('refreshes the clock when reopening a cached view after the last subscriber unmounts', async () => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2024-03-15T23:59:55'));
  const activity = { date: '2024-03-15', newCards: 1, streak: 3 };
  await replaceLearningDocument(buildLearningDocument({ reviewActivity: activity }));
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  let view = renderHook(() => useTodayReviewActivityQuery(), { wrapper });
  try {
    await act(() => vi.advanceTimersByTimeAsync(1));
    await vi.waitFor(() => expect(view.result.current.data).toEqual(activity));
    view.unmount();
    vi.setSystemTime(new Date('2024-03-16T00:00:10'));
    const reads = vi.spyOn(storage, 'getItem');
    view = renderHook(() => useTodayReviewActivityQuery(), { wrapper });
    expect(view.result.current.data).toBeNull();
    expect(reads).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    queryClient.clear();
    vi.useRealTimers();
  }
});
