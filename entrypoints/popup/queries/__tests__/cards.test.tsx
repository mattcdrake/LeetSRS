/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { Rating, State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import type { Card } from '@/domain/cards';
import background from '@/entrypoints/background';
import { onMessage, sendMessage } from '@/infrastructure/browser/messages';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';

import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { useCardsQuery, usePauseCardMutation, useRateCardMutation, useReviewQueueQuery } from '../cards';

vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  onMessage: vi.fn(),
  sendMessage: vi.fn(() => Promise.resolve(undefined)),
}));

describe('useCardsQuery', () => {
  it('reads current cards directly and refreshes after another context writes', async () => {
    fakeBrowser.reset();
    const card = createMockCard(State.New);
    const document = { schemaVersion: 6, cards: { [card.slug]: card }, stats: {}, settings: {} };
    await storage.setItem(STORAGE_KEYS.learningDocument, document);
    const { result } = renderHook(() => useCardsQuery(), { wrapper: createTestWrapper().wrapper });
    await waitFor(() => expect(result.current.data).toEqual([card]));
    await storage.setItem(STORAGE_KEYS.learningDocument, { ...document, cards: {} });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe('usePauseCardMutation', () => {
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
  beforeEach(async () => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    background.main();
    const messaging = createMessageMock(vi.mocked(sendMessage)).reset();
    for (const [name, listener] of vi.mocked(onMessage).mock.calls) {
      messaging.handle(name, (data) => listener({ id: 1, type: name, data, timestamp: 0, sender: {} }));
    }
    await sendMessage('waitForInitialization');
  });

  it.each([State.Learning, State.Relearning])(
    'refreshes an empty queue when a state %i card becomes due',
    async (state) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      const card = createMockCard(state);
      card.fsrs.due = Date.now() + 10_000;
      await sendMessage('importData', {
        jsonData: JSON.stringify({ schemaVersion: 6, cards: { [card.slug]: card }, stats: {}, settings: {} }),
      });
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
    await sendMessage('importData', {
      jsonData: JSON.stringify({ schemaVersion: 6, cards: { [card.slug]: card }, stats: {}, settings: {} }),
    });

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
