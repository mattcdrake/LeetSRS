import { QueryClientProvider } from '@tanstack/react-query';
/** @vitest-environment happy-dom */
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { State } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { createDailyStats } from '@/domain/statistics';
import { replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createTestQueryClient, createTestWrapper } from '@/test/utils/test-wrapper';
import { useCardStateStatsQuery, useLastNDaysStatsQuery, useNextNDaysStatsQuery, useTodayStatsQuery } from '../stats';

beforeEach(() => {
  fakeBrowser.reset();
  vi.setSystemTime(new Date('2024-03-15T12:00:00'));
});
it('preserves card-state, history, and upcoming statistics results', async () => {
  const cards = [
    createMockCard(State.New, { slug: 'overdue' }),
    createMockCard(State.Learning, { slug: 'today' }),
    createMockCard(State.Review, { slug: 'tomorrow' }),
    createMockCard(State.Relearning, { slug: 'paused', paused: true }),
    createMockCard(State.Review, { slug: 'outside' }),
  ];
  cards[0].fsrs.due = new Date('2024-03-14T12:00:00').getTime();
  cards[2].fsrs.due = new Date('2024-03-16T00:00:00').getTime();
  cards[4].fsrs.due = new Date('2024-03-17T00:00:00').getTime();
  const yesterday = {
    date: '2024-03-14',
    streak: 7,
    totalReviews: 3,
    newCards: 1,
    reviewedCards: 2,
    gradeBreakdown: { 1: 1, 2: 0, 3: 2, 4: 0 },
  };
  await replaceLearningDocument({
    schemaVersion: 6,
    cards: Object.fromEntries(cards.map((card) => [card.slug, card])),
    stats: { '2024-03-14': yesterday },
    settings: {},
  });

  const { result } = renderHook(
    () => ({
      states: useCardStateStatsQuery(),
      today: useTodayStatsQuery(),
      history: useLastNDaysStatsQuery(2),
      upcoming: useNextNDaysStatsQuery(2),
      emptyHistory: useLastNDaysStatsQuery(0),
      emptyUpcoming: useNextNDaysStatsQuery(0),
    }),
    { wrapper: createTestWrapper().wrapper }
  );
  await waitFor(() => expect(result.current.emptyUpcoming.isSuccess).toBe(true));
  expect(result.current.states.data).toEqual({ 0: 1, 1: 1, 2: 2, 3: 1 });
  expect(result.current.today.data).toBeNull();
  expect(result.current.history.data).toEqual([
    yesterday,
    {
      date: '2024-03-15',
      streak: 0,
      totalReviews: 0,
      newCards: 0,
      reviewedCards: 0,
      gradeBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0 },
    },
  ]);
  expect(result.current.upcoming.data).toEqual([
    { date: '2024-03-15', count: 2 },
    { date: '2024-03-16', count: 1 },
  ]);
  expect(result.current.emptyHistory.data).toEqual([]);
  expect(result.current.emptyUpcoming.data).toEqual([]);
});

it.each(['history', 'upcoming'] as const)(
  'uses a captured document and day for %s when a read crosses midnight',
  async (kind) => {
    const card = createMockCard(State.Review);
    const document = buildLearningDocument({
      cards: { [card.slug]: card },
      stats: { '2024-03-15': { ...createDailyStats('2024-03-15', undefined), totalReviews: 3 } },
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
    const useStats = kind === 'history' ? useLastNDaysStatsQuery : useNextNDaysStatsQuery;
    const view = renderHook(() => useStats(1), { wrapper });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(view.result.current.data).toEqual([
      kind === 'history' ? document.stats['2024-03-15'] : { date: '2024-03-15', count: 1 },
    ]);
    view.unmount();
    queryClient.clear();
  }
);
