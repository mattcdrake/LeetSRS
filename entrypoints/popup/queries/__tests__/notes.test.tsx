/**
 * @vitest-environment happy-dom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { sendMessage } from '@/infrastructure/browser/messages';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { noteQueryKeys, useDeleteNoteMutation, useSaveNoteMutation } from '../notes';

vi.mock('@/infrastructure/browser/messages', () => ({
  sendMessage: vi.fn(() => Promise.resolve(undefined)),
}));

describe('useSaveNoteMutation', () => {
  it('sends note edits and invalidates the saved card note', async () => {
    const cardId = 'test-card-cache';
    const noteText = '  Solution with whitespace  ';
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

    expect(sendMessage).toHaveBeenCalledWith('saveNote', { cardId, text: noteText });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: noteQueryKeys.detail(cardId),
    });

    invalidateQueriesSpy.mockRestore();
  });
});

describe('useDeleteNoteMutation', () => {
  it('sends deletion and invalidates the deleted card note', async () => {
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

    expect(sendMessage).toHaveBeenCalledWith('deleteNote', { cardId });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: noteQueryKeys.detail(cardId),
    });

    invalidateQueriesSpy.mockRestore();
  });
});
