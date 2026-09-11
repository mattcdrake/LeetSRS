/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import background from '@/entrypoints/background';
import { onMessage, sendMessage } from '@/infrastructure/browser/messages';
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
      expect(result.current.note.data).toEqual({ text: '  Use a map  ' });
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
    await waitFor(() => expect(result.current.note.data).toEqual({ text: 'Previous note' }));
    const card = (await sendMessage('getAllCards'))[0];
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
