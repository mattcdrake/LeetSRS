/** @vitest-environment happy-dom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { NOTES_MAX_LENGTH } from '@/domain/cards';
import { noteQueryKeys } from '@/entrypoints/popup/queries/notes';
import { sendMessage } from '@/infrastructure/browser/messages';
import { replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { deleteNote, saveNote } from '@/services/learning';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { useNoteEditor } from '../useNoteEditor';

vi.mock('@/infrastructure/browser/messages', () => ({ sendMessage: vi.fn() }));

describe('useNoteEditor', () => {
  const slug = 'test-card-123';
  const messages = createMessageMock(vi.mocked(sendMessage));

  const renderEditor = async (note: string | null = null) => {
    const { wrapper, queryClient } = createTestWrapper();
    await replaceLearningDocument(
      buildLearningDocument({ cards: { [slug]: createMockCard(State.New, { slug, note: note ?? undefined }) } })
    );
    queryClient.setQueryData(noteQueryKeys.detail(slug), note);
    return renderHook(() => useNoteEditor(slug), { wrapper });
  };

  beforeEach(() => {
    fakeBrowser.reset();
    messages
      .reset()
      .handle('saveNote', ({ slug, text }) => saveNote(slug, text))
      .handle('deleteNote', ({ slug }) => deleteNote(slug));
  });

  it('syncs text with stored note data', async () => {
    const { result } = await renderEditor('Existing note');
    expect(result.current.text).toBe('Existing note');
    expect(result.current.characterCount).toBe(13);
    expect(result.current.hasExistingNote).toBe(true);

    const empty = await renderEditor();
    expect(empty.result.current.text).toBe('');
    expect(empty.result.current.hasExistingNote).toBe(false);
  });

  it('exposes real loading and mutation pending states', async () => {
    const query = Promise.withResolvers<string | null>();
    const save = Promise.withResolvers<void>();
    const remove = Promise.withResolvers<void>();
    messages.reset().resolve('saveNote', save.promise).resolve('deleteNote', remove.promise);
    vi.spyOn(storage, 'getItem').mockImplementation(() => query.promise.then(() => buildLearningDocument()));
    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useNoteEditor(slug), { wrapper });

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

  it('computes save eligibility', async () => {
    const { result } = await renderEditor('Existing note');
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
    const { result } = await renderEditor();
    act(() => result.current.setText('A new note'));
    await act(() => result.current.save());
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { slug, text: 'A new note' });
    await waitFor(() => expect(result.current.text).toBe('A new note'));
  });

  it('retains the draft when saving fails', async () => {
    const error = new Error('Save failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('saveNote', () => Promise.reject(error));
    const { result } = await renderEditor('Existing note');
    act(() => result.current.setText('Edited note'));
    await act(() => result.current.save());
    expect(result.current.text).toBe('Edited note');
    expect(consoleError).toHaveBeenCalledWith('Failed to save note:', error);
    consoleError.mockRestore();
  });

  it('requires confirmation, then deletes and clears the text', async () => {
    const { result } = await renderEditor('Existing note');
    await act(() => result.current.remove());
    expect(result.current.deleteConfirm).toBe(true);
    expect(sendMessage).not.toHaveBeenCalledWith('deleteNote', expect.anything());
    await act(() => result.current.remove());
    expect(sendMessage).toHaveBeenCalledWith('deleteNote', { slug });
    expect(result.current.text).toBe('');
    expect(result.current.deleteConfirm).toBe(false);
  });

  it('keeps the text when deleting fails', async () => {
    const error = new Error('Delete failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    messages.handle('deleteNote', () => Promise.reject(error));
    const { result } = await renderEditor('Existing note');
    await act(() => result.current.remove());
    await act(() => result.current.remove());
    expect(result.current.text).toBe('Existing note');
    expect(result.current.deleteConfirm).toBe(false);
    expect(consoleError).toHaveBeenCalledWith('Failed to delete note:', error);
    consoleError.mockRestore();
  });

  it('distinguishes no note from a stored empty note', async () => {
    expect((await renderEditor('')).result.current.hasExistingNote).toBe(true);
    expect((await renderEditor()).result.current.hasExistingNote).toBe(false);
  });
});
