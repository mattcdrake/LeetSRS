/**
 * @vitest-environment happy-dom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/shared/messages';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { noteQueryKeys, useDeleteNoteMutation, useSaveNoteMutation } from '../notes';

vi.mock('@/shared/messages', () => ({
  sendMessage: vi.fn(() => Promise.resolve(undefined)),
}));

describe('useSaveNoteMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call sendMessage with correct parameters when mutate is called', async () => {
    const cardId = 'test-card-123';
    const noteText = 'This is my solution using two pointers approach';

    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSaveNoteMutation(cardId), {
      wrapper: createTestWrapper().wrapper,
    });

    result.current.mutate(noteText);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('saveNote', {
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
      wrapper: createTestWrapper().wrapper,
    });

    result.current.mutate(noteText);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('saveNote', {
        cardId: 'test-card-456',
        text: '',
      });
    });
  });

  it('should handle maximum length note text', async () => {
    const cardId = 'test-card-789';
    const noteText = 'a'.repeat(500);

    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSaveNoteMutation(cardId), {
      wrapper: createTestWrapper().wrapper,
    });

    result.current.mutate(noteText);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('saveNote', {
        cardId: 'test-card-789',
        text: noteText,
      });
    });
  });

  it('should invalidate note query cache on successful save', async () => {
    const cardId = 'test-card-cache';
    const noteText = 'Test note for cache invalidation';
    const { wrapper, queryClient } = createTestWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const { result } = renderHook(() => useSaveNoteMutation(cardId), {
      wrapper,
    });

    result.current.mutate(noteText);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: noteQueryKeys.detail(cardId),
    });

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
      wrapper: createTestWrapper().wrapper,
    });

    result.current.mutate();

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('deleteNote', {
        cardId: 'test-card-123',
      });
    });
  });

  it('should invalidate note query cache on successful delete', async () => {
    const cardId = 'test-card-delete';
    const { wrapper, queryClient } = createTestWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteNoteMutation(cardId), {
      wrapper,
    });

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: noteQueryKeys.detail(cardId),
    });

    invalidateQueriesSpy.mockRestore();
  });
});
