/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNoteEditor } from '../useNoteEditor';
import { useNoteQuery, useSaveNoteMutation, useDeleteNoteMutation } from '@/hooks/useBackgroundQueries';
import { createQueryMock, createMutationMock } from '@/test/utils/query-mocks';
import { NOTES_MAX_LENGTH, type Note } from '@/shared/notes';

// Mock the hooks
vi.mock('@/hooks/useBackgroundQueries', () => ({
  useNoteQuery: vi.fn(),
  useSaveNoteMutation: vi.fn(),
  useDeleteNoteMutation: vi.fn(),
}));

describe('useNoteEditor', () => {
  const mockCardId = 'test-card-123';
  const mockSaveMutateAsync = vi.fn();
  const mockDeleteMutateAsync = vi.fn();

  const mockNote = (note: Note | null, overrides = {}) => {
    vi.mocked(useNoteQuery).mockReturnValue(createQueryMock(note, overrides) as ReturnType<typeof useNoteQuery>);
  };

  const mockSave = (overrides = {}) => {
    vi.mocked(useSaveNoteMutation).mockReturnValue(
      createMutationMock({ mutateAsync: mockSaveMutateAsync, ...overrides }) as ReturnType<typeof useSaveNoteMutation>
    );
  };

  const mockDelete = (overrides = {}) => {
    vi.mocked(useDeleteNoteMutation).mockReturnValue(
      createMutationMock({ mutateAsync: mockDeleteMutateAsync, ...overrides }) as ReturnType<
        typeof useDeleteNoteMutation
      >
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSaveMutateAsync.mockResolvedValue(undefined);
    mockDeleteMutateAsync.mockResolvedValue(undefined);

    // Default mocks - no existing note, idle mutations
    mockNote(null);
    mockSave();
    mockDelete();
  });

  describe('syncing with the query', () => {
    it('should start empty when there is no note', () => {
      const { result } = renderHook(() => useNoteEditor(mockCardId));

      expect(result.current.text).toBe('');
      expect(result.current.characterCount).toBe(0);
    });

    it('should seed text from the fetched note', () => {
      mockNote({ text: 'Existing note' });

      const { result } = renderHook(() => useNoteEditor(mockCardId));

      expect(result.current.text).toBe('Existing note');
      expect(result.current.characterCount).toBe(13);
    });

    it('should reset text and delete confirmation when the note changes', async () => {
      mockNote({ text: 'Existing note' });

      const { result, rerender } = renderHook(() => useNoteEditor(mockCardId));

      await act(async () => {
        await result.current.remove();
      });
      expect(result.current.deleteConfirm).toBe(true);

      mockNote({ text: 'Updated elsewhere' });
      rerender();

      expect(result.current.text).toBe('Updated elsewhere');
      expect(result.current.deleteConfirm).toBe(false);
    });

    it('should expose the query and mutation states', () => {
      const error = new Error('Failed to load');
      mockNote(null, { isLoading: true, error });
      mockSave({ isPending: true });
      mockDelete({ isPending: true });

      const { result } = renderHook(() => useNoteEditor(mockCardId));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isSaving).toBe(true);
      expect(result.current.isDeleting).toBe(true);
      expect(result.current.error).toBe(error);
    });
  });

  describe('canSave', () => {
    it('should be false when the text is unchanged', () => {
      mockNote({ text: 'Existing note' });

      const { result } = renderHook(() => useNoteEditor(mockCardId));

      expect(result.current.canSave).toBe(false);
    });

    it('should be true when the text has changed', () => {
      mockNote({ text: 'Existing note' });

      const { result } = renderHook(() => useNoteEditor(mockCardId));

      act(() => {
        result.current.setText('Edited note');
      });

      expect(result.current.canSave).toBe(true);
    });

    it('should be false when the text is empty', () => {
      mockNote({ text: 'Existing note' });

      const { result } = renderHook(() => useNoteEditor(mockCardId));

      act(() => {
        result.current.setText('');
      });

      expect(result.current.canSave).toBe(false);
    });

    it('should be false when the text is over the limit', () => {
      const { result } = renderHook(() => useNoteEditor(mockCardId));

      act(() => {
        result.current.setText('a'.repeat(NOTES_MAX_LENGTH + 1));
      });

      expect(result.current.isOverLimit).toBe(true);
      expect(result.current.characterCount).toBe(NOTES_MAX_LENGTH + 1);
      expect(result.current.canSave).toBe(false);
    });

    it('should be true at exactly the limit', () => {
      const { result } = renderHook(() => useNoteEditor(mockCardId));

      act(() => {
        result.current.setText('a'.repeat(NOTES_MAX_LENGTH));
      });

      expect(result.current.isOverLimit).toBe(false);
      expect(result.current.canSave).toBe(true);
    });
  });

  describe('save', () => {
    it('should save the current text', async () => {
      const { result } = renderHook(() => useNoteEditor(mockCardId));

      act(() => {
        result.current.setText('A new note');
      });

      await act(async () => {
        await result.current.save();
      });

      expect(mockSaveMutateAsync).toHaveBeenCalledWith('A new note');
      expect(result.current.text).toBe('A new note');
    });

    it('should revert to the stored text when saving fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockNote({ text: 'Existing note' });
      mockSaveMutateAsync.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useNoteEditor(mockCardId));

      act(() => {
        result.current.setText('Edited note');
      });

      await act(async () => {
        await result.current.save();
      });

      expect(result.current.text).toBe('Existing note');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save note:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      mockNote({ text: 'Existing note' });
    });

    it('should arm the confirmation on the first call without deleting', async () => {
      const { result } = renderHook(() => useNoteEditor(mockCardId));

      await act(async () => {
        await result.current.remove();
      });

      expect(result.current.deleteConfirm).toBe(true);
      expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
      expect(result.current.text).toBe('Existing note');
    });

    it('should delete and clear the text on the second call', async () => {
      const { result } = renderHook(() => useNoteEditor(mockCardId));

      await act(async () => {
        await result.current.remove();
      });
      await act(async () => {
        await result.current.remove();
      });

      expect(mockDeleteMutateAsync).toHaveBeenCalledTimes(1);
      expect(result.current.text).toBe('');
      expect(result.current.deleteConfirm).toBe(false);
    });

    it('should keep the text and disarm when deleting fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDeleteMutateAsync.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useNoteEditor(mockCardId));

      await act(async () => {
        await result.current.remove();
      });
      await act(async () => {
        await result.current.remove();
      });

      expect(result.current.text).toBe('Existing note');
      expect(result.current.deleteConfirm).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to delete note:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('delete confirmation timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockNote({ text: 'Existing note' });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should reset the confirmation after 3000ms', async () => {
      const { result } = renderHook(() => useNoteEditor(mockCardId));

      await act(async () => {
        await result.current.remove();
      });
      expect(result.current.deleteConfirm).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2999);
      });
      expect(result.current.deleteConfirm).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.deleteConfirm).toBe(false);
    });

    it('should clear a pending confirmation timer on unmount', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      const { result, unmount } = renderHook(() => useNoteEditor(mockCardId));

      await act(async () => {
        await result.current.remove();
      });

      const timerIndex = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === 3000);
      expect(timerIndex).toBeGreaterThanOrEqual(0);
      const timerId = setTimeoutSpy.mock.results[timerIndex].value;

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);

      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('hasExistingNote', () => {
    it('should be true when a note row exists', () => {
      mockNote({ text: 'Existing note' });

      const { result } = renderHook(() => useNoteEditor(mockCardId));

      expect(result.current.hasExistingNote).toBe(true);
    });

    it('should be true for a stored note with empty text', () => {
      mockNote({ text: '' });

      const { result } = renderHook(() => useNoteEditor(mockCardId));

      expect(result.current.hasExistingNote).toBe(true);
    });

    it('should be false when there is no note', () => {
      mockNote(null);

      const { result } = renderHook(() => useNoteEditor(mockCardId));

      expect(result.current.hasExistingNote).toBe(false);
    });
  });
});
