import { QueryClientProvider } from '@tanstack/react-query';
/** @vitest-environment happy-dom */
import { renderHook, waitFor } from '@testing-library/react';
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
it('uses a captured document and day for activity when a read crosses midnight', async () => {
  const card = createMockCard(State.Review);
  const document = buildLearningDocument({
    cards: { [card.frontendId]: card },
    reviewActivity: { date: '2024-03-15', newCards: 1, streak: 3 },
  });
  await replaceLearningDocument(document);
  const get = storage.getItem.bind(storage);
  vi.spyOn(storage, 'getItem').mockImplementationOnce(async (key) => {
    const snapshot = await get(key);
    vi.setSystemTime(new Date('2024-03-16T00:00:00'));
    await replaceLearningDocument(buildLearningDocument());
    return snapshot;
  });
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useTodayReviewActivityQuery(), { wrapper });
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  expect(view.result.current.data).toEqual({ date: '2024-03-15', newCards: 1, streak: 3 });
  view.unmount();
  queryClient.clear();
});
