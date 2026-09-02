/**
 * @vitest-environment happy-dom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { createEmptyCard, type Grade, Rating } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/shared/cards';
import { sendMessage } from '@/shared/messages';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { cardQueryKeys, useCardsQuery, usePauseCardMutation, useRateCardMutation } from '../cards';

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

describe('usePauseCardMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call sendMessage with correct parameters when pausing a card', async () => {
    const mockCard: Card = {
      id: 'test-id',
      slug: 'two-sum',
      name: 'Two Sum',
      leetcodeId: '1',
      difficulty: 'Easy',
      domain: 'leetcode.com',
      createdAt: new Date(),
      fsrs: createEmptyCard(),
      paused: true,
    };

    vi.mocked(sendMessage).mockResolvedValue(mockCard);

    const { result } = renderHook(() => usePauseCardMutation(), {
      wrapper: createTestWrapper().wrapper,
    });

    result.current.mutate({ slug: 'two-sum', paused: true });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('setPauseStatus', {
        slug: 'two-sum',
        paused: true,
      });
    });
  });

  it('should call sendMessage with correct parameters when unpausing a card', async () => {
    const mockCard: Card = {
      id: 'test-id',
      slug: 'three-sum',
      name: 'Three Sum',
      leetcodeId: '15',
      difficulty: 'Medium',
      domain: 'leetcode.com',
      createdAt: new Date(),
      fsrs: createEmptyCard(),
      paused: false,
    };

    vi.mocked(sendMessage).mockResolvedValue(mockCard);

    const { result } = renderHook(() => usePauseCardMutation(), {
      wrapper: createTestWrapper().wrapper,
    });

    result.current.mutate({ slug: 'three-sum', paused: false });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('setPauseStatus', {
        slug: 'three-sum',
        paused: false,
      });
    });
  });

  it('should invalidate cards and review queue queries on successful pause', async () => {
    const mockCard: Card = {
      id: 'test-id',
      slug: 'test-problem',
      name: 'Test Problem',
      leetcodeId: '999',
      difficulty: 'Hard',
      domain: 'leetcode.com',
      createdAt: new Date(),
      fsrs: createEmptyCard(),
      paused: true,
    };

    const { wrapper, queryClient } = createTestWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(sendMessage).mockResolvedValue(mockCard);

    const { result } = renderHook(() => usePauseCardMutation(), {
      wrapper,
    });

    result.current.mutate({ slug: 'test-problem', paused: true });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: cardQueryKeys.all,
    });

    invalidateQueriesSpy.mockRestore();
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
