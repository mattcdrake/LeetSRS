/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRateCardMutation } from '../useBackgroundQueries';
import { sendMessage } from '@/services/messages';
import { MessageType } from '@/services/messages';
import { Rating, type Grade, createEmptyCard } from 'ts-fsrs';
import { createWrapper } from '@/test/utils/test-wrapper';
import type { Card } from '@/types';

// Mock the sendMessage function
vi.mock('@/services/messages', () => ({
  sendMessage: vi.fn(),
  MessageType: {
    RATE_CARD: 'RATE_CARD',
  },
}));

describe('useRateCardMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call sendMessage with correct parameters when mutate is called', async () => {
    const mockCard = {
      slug: 'two-sum',
      name: 'Two Sum',
      rating: Rating.Good as Grade,
      leetcodeId: '1',
      difficulty: 'Easy' as const,
    };

    const mockResponse: Card = {
      id: 'test-id',
      slug: mockCard.slug,
      name: mockCard.name,
      leetcodeId: mockCard.leetcodeId,
      difficulty: mockCard.difficulty,
      createdAt: new Date(),
      fsrs: createEmptyCard(),
    };

    vi.mocked(sendMessage).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useRateCardMutation(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(mockCard);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: MessageType.RATE_CARD,
        slug: 'two-sum',
        name: 'Two Sum',
        rating: Rating.Good,
        leetcodeId: '1',
        difficulty: 'Easy',
      });
    });
  });
});
