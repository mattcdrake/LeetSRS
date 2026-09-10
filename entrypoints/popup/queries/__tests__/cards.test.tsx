/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { Rating, State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Card } from '@/domain/cards';
import { messages as backgroundMessages } from '@/entrypoints/background/message-handlers';
import { createBackgroundMessageRunner } from '@/entrypoints/background/message-runner';
import { sendMessage } from '@/infrastructure/browser/messages';
import { saveCards } from '@/infrastructure/storage/cards';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import {
  cardQueryKeys,
  useCardsQuery,
  useDelayCardMutation,
  usePauseCardMutation,
  useRateCardMutation,
  useRemoveCardMutation,
  useReviewQueueQuery,
} from '../cards';
import { statsQueryKeys } from '../stats';

vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  sendMessage: vi.fn(() => Promise.resolve(undefined)),
}));

describe('useCardsQuery', () => {
  it('sends a message without a payload', async () => {
    vi.mocked(sendMessage).mockResolvedValue([]);

    const { result } = renderHook(() => useCardsQuery(), {
      wrapper: createTestWrapper().wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sendMessage).toHaveBeenCalledWith('getAllCards');
  });
});

describe('card mutation invalidation', () => {
  it('invalidates only the queries affected by each mutation', async () => {
    const problem = buildProblem();
    const { wrapper, queryClient } = createTestWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => ({
        remove: useRemoveCardMutation(),
        rate: useRateCardMutation(),
        delay: useDelayCardMutation(),
        pause: usePauseCardMutation(),
      }),
      { wrapper }
    );

    const expectInvalidations = async (mutate: () => Promise<unknown>, queryKeys: readonly (readonly unknown[])[]) => {
      invalidateQueries.mockClear();
      await act(mutate);
      expect(invalidateQueries.mock.calls.map(([filters]) => filters)).toEqual(
        queryKeys.map((queryKey) => ({ queryKey }))
      );
    };

    await expectInvalidations(
      () => result.current.remove.mutateAsync(problem.slug),
      [cardQueryKeys.all, statsQueryKeys.all]
    );
    await expectInvalidations(
      () => result.current.delay.mutateAsync({ slug: problem.slug, days: 1 }),
      [cardQueryKeys.all, statsQueryKeys.all]
    );
    await expectInvalidations(
      () => result.current.pause.mutateAsync({ slug: problem.slug, paused: true }),
      [cardQueryKeys.all, statsQueryKeys.all]
    );
    await expectInvalidations(
      () => result.current.rate.mutateAsync({ ...problem, rating: Rating.Good }),
      [cardQueryKeys.all, statsQueryKeys.all]
    );
  });
});

describe('usePauseCardMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['pausing', 'two-sum', true],
    ['unpausing', 'three-sum', false],
  ] as const)('sends the correct message when %s a card', async (_action, slug, paused) => {
    const mockCard: Card = {
      id: 'test-id',
      slug,
      name: 'Two Sum',
      leetcodeId: '1',
      difficulty: 'Easy',
      domain: 'leetcode.com',
      createdAt: Date.now(),
      fsrs: createMockCard(State.New).fsrs,
      paused,
    };

    vi.mocked(sendMessage).mockResolvedValue(mockCard);

    const { result } = renderHook(() => usePauseCardMutation(), {
      wrapper: createTestWrapper().wrapper,
    });

    result.current.mutate({ slug, paused });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('setPauseStatus', {
        slug,
        paused,
      });
    });
  });

  it('should handle mutation error properly', async () => {
    const errorMessage = 'Card not found';
    vi.mocked(sendMessage).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => usePauseCardMutation(), {
      wrapper: createTestWrapper().wrapper,
    });

    result.current.mutate({ slug: 'non-existent', paused: true });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toBe(errorMessage);
    });
  });
});

describe('card queries through JSON messaging and background handlers', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    const runner = createBackgroundMessageRunner({
      ready: Promise.resolve(),
      markDataUpdated: vi.fn(),
      refreshBadge: vi.fn(),
    });
    createMessageMock(vi.mocked(sendMessage))
      .reset()
      .handle('getAllCards', (data) => runner.execute<'getAllCards'>(backgroundMessages.getAllCards, data))
      .handle('getReviewQueue', (data) => runner.execute<'getReviewQueue'>(backgroundMessages.getReviewQueue, data))
      .handle('rateCard', (data) => runner.execute<'rateCard'>(backgroundMessages.rateCard, data));
  });

  it.each([State.Learning, State.Relearning])(
    'refreshes an empty queue when a state %i card becomes due',
    async (state) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      const card = createMockCard(state);
      card.fsrs.due = Date.now() + 10_000;
      await saveCards([card]);
      const view = renderHook(() => useReviewQueueQuery(), { wrapper: createTestWrapper().wrapper });

      try {
        await act(() => vi.advanceTimersByTimeAsync(1));
        expect(view.result.current.isSuccess).toBe(true);
        expect(view.result.current.data).toEqual([]);

        await act(() => vi.advanceTimersByTimeAsync(15_000));
        expect(view.result.current.data).toEqual([card]);
      } finally {
        view.unmount();
        vi.useRealTimers();
      }
    }
  );

  it.each([0, undefined])('preserves numeric dates and last_review=%s in query results', async (lastReview) => {
    const card = createMockCard(State.Review, { createdAt: 0 });
    card.fsrs.due = 0;
    if (lastReview === undefined) delete card.fsrs.last_review;
    else card.fsrs.last_review = lastReview;
    await saveCards([card]);

    const { result } = renderHook(() => useCardsQuery(), { wrapper: createTestWrapper().wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toStrictEqual([card]);
  });

  it('returns numeric dates from scheduling through a mutation', async () => {
    const { result } = renderHook(() => useRateCardMutation(), { wrapper: createTestWrapper().wrapper });

    await act(async () => {
      const { card } = await result.current.mutateAsync({ ...buildProblem(), rating: Rating.Good });
      expect(sendMessage).toHaveBeenCalledWith('rateCard', { input: { ...buildProblem(), rating: Rating.Good } });
      expect(card).toMatchObject(buildProblem());
      expect(card.createdAt).toEqual(expect.any(Number));
      expect(card.fsrs.due).toEqual(expect.any(Number));
      expect(card.fsrs.last_review).toEqual(expect.any(Number));
    });
  });
});
