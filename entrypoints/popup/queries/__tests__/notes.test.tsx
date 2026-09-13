import { NoteEditor } from '@/entrypoints/popup/components/notes/NoteEditor';
/**
 * @vitest-environment happy-dom
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import background from '@/entrypoints/background';
import { onMessage, sendMessage } from '@/infrastructure/browser/messages';
import { requireDefined } from '@/test/utils/assertions';
import { buildProblem } from '@/test/utils/card-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestWrapper } from '@/test/utils/test-wrapper';
import { useCardsQuery, useRemoveCardMutation, useReviewQueueQuery } from '../cards';
import { useImportDataMutation, useResetAllDataMutation } from '../data';
import { useDeleteNoteMutation, useNoteQuery, useSaveNoteMutation } from '../notes';

vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  onMessage: vi.fn(),
  sendMessage: vi.fn(),
}));

const problem = buildProblem();

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  background.main();
  const messaging = createMessageMock(vi.mocked(sendMessage)).reset();
  for (const [name, listener] of vi.mocked(onMessage).mock.calls) {
    messaging.handle(name, (data) => listener({ id: 1, type: name, data, timestamp: 0, sender: {} }));
  }
  await sendMessage('addCard', { problem });
});

describe('note and card query coherence', () => {
  it('refreshes the card list, review queue, and note after saving and deleting by slug', async () => {
    const { result } = renderHook(
      () => ({
        note: useNoteQuery(problem.slug),
        cards: useCardsQuery(),
        queue: useReviewQueueQuery(),
        save: useSaveNoteMutation(problem.slug),
        remove: useDeleteNoteMutation(problem.slug),
      }),
      { wrapper: createTestWrapper().wrapper }
    );
    await waitFor(() => expect(result.current.note.isSuccess).toBe(true));
    expect(result.current.note.data).toBeNull();

    await act(() => result.current.save.mutateAsync('  Use a map  '));
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { slug: problem.slug, text: '  Use a map  ' });
    await waitFor(() => {
      expect(result.current.note.data).toBe('  Use a map  ');
      expect(result.current.cards.data).toMatchObject([{ slug: problem.slug, note: '  Use a map  ' }]);
      expect(result.current.queue.data).toMatchObject([{ slug: problem.slug, note: '  Use a map  ' }]);
    });
    await act(() => result.current.remove.mutateAsync());
    expect(sendMessage).toHaveBeenCalledWith('deleteNote', { slug: problem.slug });
    await waitFor(() => {
      expect(result.current.note.data).toBeNull();
      expect(result.current.cards.data?.[0]).not.toHaveProperty('note');
      expect(result.current.queue.data?.[0]).not.toHaveProperty('note');
    });
  });

  it.each(['remove', 'import', 'reset'] as const)('clears a cached note after %s', async (operation) => {
    await sendMessage('saveNote', { slug: problem.slug, text: 'Previous note' });
    const { result } = renderHook(
      () => ({
        note: useNoteQuery(problem.slug),
        cards: useCardsQuery(),
        remove: useRemoveCardMutation(),
        import: useImportDataMutation(),
        reset: useResetAllDataMutation(),
      }),
      { wrapper: createTestWrapper().wrapper }
    );
    await waitFor(() => expect(result.current.note.data).toBe('Previous note'));
    const card = requireDefined(result.current.cards.data?.[0]);
    const { note: _note, ...replacement } = card;
    await act(async () => {
      if (operation === 'remove') await result.current.remove.mutateAsync(problem.slug);
      if (operation === 'reset') await result.current.reset.mutateAsync();
      if (operation === 'import')
        await result.current.import.mutateAsync(
          JSON.stringify({
            schemaVersion: 4,
            exportDate: '2024-01-01',
            data: { cards: { [problem.slug]: replacement }, stats: {} },
          })
        );
    });
    await waitFor(() => {
      expect(result.current.note.data).toBeNull();
      expect(result.current.cards.data).toEqual(operation === 'import' ? [replacement] : []);
    });
  });
});

it('preserves a dirty rendered note through incoming replacement and saves its draft', async () => {
  await sendMessage('saveNote', { slug: problem.slug, text: 'Original' });
  render(<NoteEditor slug={problem.slug} variant="regular" />, { wrapper: createTestWrapper().wrapper });
  const input = screen.getByRole('textbox', { name: 'Note text' });
  await waitFor(() => expect(input).toHaveValue('Original'));
  await act(() => sendMessage('saveNote', { slug: problem.slug, text: 'Untouched update' }));
  await waitFor(() => expect(input).toHaveValue('Untouched update'));
  fireEvent.change(input, { target: { value: 'My draft' } });
  await act(() => sendMessage('deleteNote', { slug: problem.slug }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument());
  expect(input).toHaveValue('My draft');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
  expect(input).toHaveValue('My draft');
  await act(() => sendMessage('saveNote', { slug: problem.slug, text: 'Later update' }));
  await waitFor(() => expect(input).toHaveValue('Later update'));
});
