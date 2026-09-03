/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { createEmptyCard, type Grade, Rating } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/shared/cards';
import { sendMessage } from '@/shared/messages';
import { buildProblem } from '@/test/utils/card-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import {
  cardQueryKeys,
  useAddCardMutation,
  useCardsQuery,
  useDelayCardMutation,
  usePauseCardMutation,
  useRateCardMutation,
  useRemoveCardMutation,
} from '../cards';
import { statsQueryKeys } from '../stats';

vi.mock('@/shared/messages', () => ({
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

describe('useRateCardMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendMessage).mockResolvedValue(undefined);
  });

  it('should call sendMessage with correct parameters when mutate is called', async () => {
    const mockCard = {
      slug: 'two-sum',
      name: 'Two Sum',
      rating: Rating.Good as Grade,
      leetcodeId: '1',
      difficulty: 'Easy' as const,
      domain: 'leetcode.com' as const,
    };

    const mockResponse: Card = {
      id: 'test-id',
      slug: mockCard.slug,
      name: mockCard.name,
      leetcodeId: mockCard.leetcodeId,
      difficulty: mockCard.difficulty,
      domain: 'leetcode.com',
      createdAt: new Date(),
      fsrs: createEmptyCard(),
      paused: false,
    };

    vi.mocked(sendMessage).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useRateCardMutation(), {
      wrapper: createTestWrapper().wrapper,
    });

    result.current.mutate(mockCard);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('rateCard', {
        input: {
          slug: 'two-sum',
          name: 'Two Sum',
          rating: Rating.Good,
          leetcodeId: '1',
          difficulty: 'Easy',
          domain: 'leetcode.com',
        },
      });
    });
  });
});

describe('card mutation invalidation', () => {
  it('invalidates only the queries affected by each mutation', async () => {
    const problem = buildProblem();
    const { wrapper, queryClient } = createTestWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => ({
        add: useAddCardMutation(),
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

    await expectInvalidations(() => result.current.add.mutateAsync(problem), [cardQueryKeys.all, statsQueryKeys.all]);
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
      createdAt: new Date(),
      fsrs: createEmptyCard(),
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
