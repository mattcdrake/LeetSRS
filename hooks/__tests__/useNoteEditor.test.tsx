/** @vitest-environment happy-dom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/hooks/useBackgroundQueries';
import { sendMessage } from '@/shared/messages';
import { NOTES_MAX_LENGTH, type Note } from '@/shared/notes';
import { createDeferred } from '@/test/utils/deferred';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { useNoteEditor } from '../useNoteEditor';

vi.mock('@/shared/messages', () => ({ sendMessage: vi.fn() }));

describe('useNoteEditor', () => {
  const cardId = 'test-card-123';
  const messages = createMessageMock(vi.mocked(sendMessage));

  const renderEditor = (note: Note | null = null) => {
    const { wrapper, queryClient } = createTestWrapper();
    queryClient.setQueryData(queryKeys.notes.detail(cardId), note);
    return renderHook(() => useNoteEditor(cardId), { wrapper });
  };

  beforeEach(() => {
    messages.reset().resolve('getNote', null).resolve('saveNote', undefined).resolve('deleteNote', undefined);
  });

  it('syncs text with stored note data', () => {
    const { result } = renderEditor({ text: 'Existing note' });
    expect(result.current.text).toBe('Existing note');
    expect(result.current.characterCount).toBe(13);
    expect(result.current.hasExistingNote).toBe(true);

    const empty = renderEditor();
    expect(empty.result.current.text).toBe('');
    expect(empty.result.current.hasExistingNote).toBe(false);
  });

  it('exposes real loading and mutation pending states', async () => {
    const query = createDeferred<Note | null>();
    const save = createDeferred<void>();
    const remove = createDeferred<void>();
    messages
      .reset()
      .resolve('getNote', query.promise)
      .resolve('saveNote', save.promise)
      .resolve('deleteNote', remove.promise);
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useNoteEditor(cardId), { wrapper });

    expect(result.current.isLoading).toBe(true);
    act(() => result.current.setText('new'));
    act(() => void result.current.save());
    await waitFor(() => expect(result.current.isSaving).toBe(true));
    await act(() => result.current.remove());
    act(() => void result.current.remove());
    await waitFor(() => expect(result.current.isDeleting).toBe(true));

    await act(async () => {
      query.resolve(null);
      save.resolve();
      remove.resolve();
      await Promise.all([query.promise, save.promise, remove.promise]);
    });
  });

  it('computes save eligibility', () => {
    const { result } = renderEditor({ text: 'Existing note' });
    expect(result.current.canSave).toBe(false);
    act(() => result.current.setText('Edited note'));
    expect(result.current.canSave).toBe(true);
    act(() => result.current.setText(''));
    expect(result.current.canSave).toBe(false);
    act(() => result.current.setText('a'.repeat(NOTES_MAX_LENGTH + 1)));
    expect(result.current.isOverLimit).toBe(true);
    expect(result.current.canSave).toBe(false);
    act(() => result.current.setText('a'.repeat(NOTES_MAX_LENGTH)));
    expect(result.current.isOverLimit).toBe(false);
    expect(result.current.canSave).toBe(true);
  });

  it('saves the current text', async () => {
    const { result } = renderEditor();
    act(() => result.current.setText('A new note'));
    await act(() => result.current.save());
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { cardId, text: 'A new note' });
    expect(result.current.text).toBe('A new note');
  });

  it('reverts to stored text when saving fails', async () => {
    const error = new Error('Save failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('saveNote', () => Promise.reject(error));
    const { result } = renderEditor({ text: 'Existing note' });
    act(() => result.current.setText('Edited note'));
    await act(() => result.current.save());
    expect(result.current.text).toBe('Existing note');
    expect(consoleError).toHaveBeenCalledWith('Failed to save note:', error);
    consoleError.mockRestore();
  });

  it('requires confirmation, then deletes and clears the text', async () => {
    const { result } = renderEditor({ text: 'Existing note' });
    await act(() => result.current.remove());
    expect(result.current.deleteConfirm).toBe(true);
    expect(sendMessage).not.toHaveBeenCalledWith('deleteNote', expect.anything());
    await act(() => result.current.remove());
    expect(sendMessage).toHaveBeenCalledWith('deleteNote', { cardId });
    expect(result.current.text).toBe('');
    expect(result.current.deleteConfirm).toBe(false);
  });

  it('keeps the text when deleting fails', async () => {
    const error = new Error('Delete failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('deleteNote', () => Promise.reject(error));
    const { result } = renderEditor({ text: 'Existing note' });
    await act(() => result.current.remove());
    await act(() => result.current.remove());
    expect(result.current.text).toBe('Existing note');
    expect(result.current.deleteConfirm).toBe(false);
    expect(consoleError).toHaveBeenCalledWith('Failed to delete note:', error);
    consoleError.mockRestore();
  });

  it('distinguishes no note from a stored empty note', () => {
    expect(renderEditor({ text: '' }).result.current.hasExistingNote).toBe(true);
    expect(renderEditor().result.current.hasExistingNote).toBe(false);
  });
});
