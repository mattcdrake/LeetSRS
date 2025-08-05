/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useRateCardMutation,
  useSaveNoteMutation,
  useDeleteNoteMutation,
  usePauseCardMutation,
  queryKeys,
} from '../useBackgroundQueries';
import { sendMessage } from '@/services/messages';
import { MessageType } from '@/services/messages';
import { Rating, type Grade, createEmptyCard } from 'ts-fsrs';
import { createWrapper, createTestWrapper } from '@/test/utils/test-wrapper';
import type { Card } from '@/shared/cards';

// Mock the sendMessage function
vi.mock('@/services/messages', () => ({
  sendMessage: vi.fn((message) => {
    // Return appropriate default values for animations queries
    if (message.type === 'GET_ANIMATIONS_ENABLED') {
      return Promise.resolve(false);
    }
    return Promise.resolve();
  }),
  MessageType: {
    RATE_CARD: 'RATE_CARD',
    SAVE_NOTE: 'SAVE_NOTE',
    DELETE_NOTE: 'DELETE_NOTE',
    SET_PAUSE_STATUS: 'SET_PAUSE_STATUS',
    GET_ANIMATIONS_ENABLED: 'GET_ANIMATIONS_ENABLED',
    SET_ANIMATIONS_ENABLED: 'SET_ANIMATIONS_ENABLED',
  },
}));

describe('useRateCardMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure sendMessage returns appropriate values after clearing
    vi.mocked(sendMessage).mockImplementation((message) => {
      if (message.type === 'GET_ANIMATIONS_ENABLED') {
        return Promise.resolve(false);
      }
      return Promise.resolve();
    });
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
      paused: false,
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
      queryKey: queryKeys.notes.detail(cardId),
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
      queryKey: queryKeys.notes.detail(cardId),
    });

    // Clean up the spy
    invalidateQueriesSpy.mockRestore();
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
      createdAt: new Date(),
      fsrs: createEmptyCard(),
      paused: true,
    };

    vi.mocked(sendMessage).mockResolvedValue(mockCard);

    const { result } = renderHook(() => usePauseCardMutation(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ slug: 'two-sum', paused: true });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: MessageType.SET_PAUSE_STATUS,
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
      createdAt: new Date(),
      fsrs: createEmptyCard(),
      paused: false,
    };

    vi.mocked(sendMessage).mockResolvedValue(mockCard);

    const { result } = renderHook(() => usePauseCardMutation(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ slug: 'three-sum', paused: false });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: MessageType.SET_PAUSE_STATUS,
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

    // Verify that all card queries were invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['cards'],
    });

    invalidateQueriesSpy.mockRestore();
  });

  it('should handle mutation error properly', async () => {
    const errorMessage = 'Card not found';
    vi.mocked(sendMessage).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => usePauseCardMutation(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ slug: 'non-existent', paused: true });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toBe(errorMessage);
    });
  });
});
