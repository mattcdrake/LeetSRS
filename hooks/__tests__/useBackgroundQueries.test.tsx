/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRateCardMutation, useSaveNoteMutation, useDeleteNoteMutation, queryKeys } from '../useBackgroundQueries';
import { sendMessage } from '@/services/messages';
import { MessageType } from '@/services/messages';
import { Rating, type Grade, createEmptyCard } from 'ts-fsrs';
import { createWrapper, createTestWrapper } from '@/test/utils/test-wrapper';
import type { Card } from '@/shared/cards';

// Mock the sendMessage function
vi.mock('@/services/messages', () => ({
  sendMessage: vi.fn(),
  MessageType: {
    RATE_CARD: 'RATE_CARD',
    SAVE_NOTE: 'SAVE_NOTE',
    DELETE_NOTE: 'DELETE_NOTE',
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

describe('useSaveNoteMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call sendMessage with correct parameters when mutate is called', async () => {
    const cardId = 'test-card-123';
    const noteText = 'This is my solution using two pointers approach';

    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSaveNoteMutation(cardId), {
      wrapper: createWrapper(),
    });

    result.current.mutate(noteText);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: MessageType.SAVE_NOTE,
        cardId: 'test-card-123',
        text: 'This is my solution using two pointers approach',
      });
    });
  });

  it('should handle empty note text', async () => {
    const cardId = 'test-card-456';
    const noteText = '';

    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSaveNoteMutation(cardId), {
      wrapper: createWrapper(),
    });

    result.current.mutate(noteText);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: MessageType.SAVE_NOTE,
        cardId: 'test-card-456',
        text: '',
      });
    });
  });

  it('should handle maximum length note text', async () => {
    const cardId = 'test-card-789';
    const noteText = 'a'.repeat(500); // Max length from NOTES_MAX_LENGTH

    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSaveNoteMutation(cardId), {
      wrapper: createWrapper(),
    });

    result.current.mutate(noteText);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: MessageType.SAVE_NOTE,
        cardId: 'test-card-789',
        text: noteText,
      });
    });
  });

  it('should invalidate note query cache on successful save', async () => {
    const cardId = 'test-card-cache';
    const noteText = 'Test note for cache invalidation';

    // Use createTestWrapper to get access to the queryClient
    const { wrapper, queryClient } = createTestWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSaveNoteMutation(cardId), {
      wrapper,
    });

    // Trigger the mutation
    result.current.mutate(noteText);

    // Wait for the mutation to complete successfully
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify that invalidateQueries was called with the correct query key
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.note(cardId),
    });

    // Clean up the spy
    invalidateQueriesSpy.mockRestore();
  });
});

describe('useDeleteNoteMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call sendMessage with correct parameters when mutate is called', async () => {
    const cardId = 'test-card-123';

    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteNoteMutation(cardId), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: MessageType.DELETE_NOTE,
        cardId: 'test-card-123',
      });
    });
  });

  it('should invalidate note query cache on successful delete', async () => {
    const cardId = 'test-card-delete';

    // Use createTestWrapper to get access to the queryClient
    const { wrapper, queryClient } = createTestWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteNoteMutation(cardId), {
      wrapper,
    });

    // Trigger the mutation
    result.current.mutate();

    // Wait for the mutation to complete successfully
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify that invalidateQueries was called with the correct query key
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.note(cardId),
    });

    // Clean up the spy
    invalidateQueriesSpy.mockRestore();
  });
});
