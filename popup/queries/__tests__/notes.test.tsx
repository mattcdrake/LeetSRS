import { NoteEditor } from '@/popup/components/notes/NoteEditor';
import { initializeCatalog } from '@/shared/catalog';
/**
 * @vitest-environment happy-dom
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import background from '@/entrypoints/background/index';
import { onMessage, sendMessage } from '@/shared/messages';
import { requireDefined } from '@/test/utils/assertions';
import { buildProblem } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useCardsQuery, useDelayCardMutation, useRemoveCardMutation, useReviewQueueQuery } from '../cards';
import { useImportDataMutation, useResetAllDataMutation } from '../data';
import { useNoteQuery, useSaveNoteMutation } from '../notes';

vi.mock('@/shared/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/messages')>()),
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
        note: useNoteQuery(problem.frontendId),
        cards: useCardsQuery(),
        queue: useReviewQueueQuery(),
        save: useSaveNoteMutation(problem.frontendId),
      }),
      { wrapper: createPopupTestWrapper().wrapper }
    );
    await waitFor(() => expect(result.current.note.isSuccess).toBe(true));
    expect(result.current.note.data).toBeNull();

    await act(() => result.current.save.mutateAsync('  Use a map  '));
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { frontendId: problem.frontendId, text: '  Use a map  ' });
    await waitFor(() => {
      expect(result.current.note.data).toBe('  Use a map  ');
      expect(result.current.cards.data).toMatchObject([{ frontendId: problem.frontendId, note: '  Use a map  ' }]);
      expect(result.current.queue.data).toMatchObject([{ frontendId: problem.frontendId, note: '  Use a map  ' }]);
    });
    await act(() => result.current.save.mutateAsync(''));
    expect(sendMessage).toHaveBeenCalledWith('saveNote', { frontendId: problem.frontendId, text: '' });
    await waitFor(() => {
      expect(result.current.note.data).toBeNull();
      expect(result.current.cards.data?.[0]).not.toHaveProperty('note');
      expect(result.current.queue.data?.[0]).not.toHaveProperty('note');
    });
  });

  it.each(['remove', 'import', 'reset'] as const)('clears a cached note after %s', async (operation) => {
    await sendMessage('saveNote', { frontendId: problem.frontendId, text: 'Previous note' });
    const { result } = renderHook(
      () => ({
        note: useNoteQuery(problem.frontendId),
        cards: useCardsQuery(),
        remove: useRemoveCardMutation(),
        import: useImportDataMutation(),
        reset: useResetAllDataMutation(),
      }),
      { wrapper: createPopupTestWrapper().wrapper }
    );
    await waitFor(() => expect(result.current.note.data).toBe('Previous note'));
    const card = requireDefined(result.current.cards.data?.[0]);
    const { note: _note, ...replacement } = card;
    await act(async () => {
      if (operation === 'remove') await result.current.remove.mutateAsync(problem.frontendId);
      if (operation === 'reset') await result.current.reset.mutateAsync();
      if (operation === 'import')
        await result.current.import.mutateAsync(
          JSON.stringify({
            ...buildLearningDocument({ cards: { [problem.frontendId]: replacement } }),
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
  await sendMessage('saveNote', { frontendId: problem.frontendId, text: 'Original' });
  render(<NoteEditor frontendId={problem.frontendId} variant="regular" />, {
    wrapper: createPopupTestWrapper().wrapper,
  });
  const input = screen.getByRole('textbox', { name: 'Note text' });
  await waitFor(() => expect(input).toHaveValue('Original'));
  await act(() => sendMessage('saveNote', { frontendId: problem.frontendId, text: 'Untouched update' }));
  await waitFor(() => expect(input).toHaveValue('Untouched update'));
  fireEvent.change(input, { target: { value: 'My draft' } });
  await act(() => sendMessage('saveNote', { frontendId: problem.frontendId, text: '' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument());
  expect(input).toHaveValue('My draft');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
  expect(input).toHaveValue('My draft');
  await act(() => sendMessage('saveNote', { frontendId: problem.frontendId, text: 'Later update' }));
  await waitFor(() => expect(input).toHaveValue('Later update'));
});

it('keeps the outgoing card note live after it leaves the review queue', async () => {
  const next = buildProblem({ frontendId: 'next-card' });
  await sendMessage('addCard', { problem: next });
  await sendMessage('saveNote', { frontendId: problem.frontendId, text: 'Outgoing note' });
  await sendMessage('saveNote', { frontendId: next.frontendId, text: 'Next note' });
  const view = renderHook(
    ({ frontendId }) => ({
      note: useNoteQuery(frontendId),
      queue: useReviewQueueQuery(),
      delay: useDelayCardMutation(),
    }),
    { initialProps: { frontendId: problem.frontendId }, wrapper: createPopupTestWrapper().wrapper }
  );
  await waitFor(() => expect(view.result.current.note.data).toBe('Outgoing note'));
  await act(() => view.result.current.delay.mutateAsync({ frontendId: problem.frontendId, days: 1 }));
  await waitFor(() => expect(view.result.current.queue.data).toMatchObject([{ frontendId: next.frontendId }]));
  expect(view.result.current.note.data).toBe('Outgoing note');
  await act(() => sendMessage('saveNote', { frontendId: problem.frontendId, text: '' }));
  await waitFor(() => expect(view.result.current.note.data).toBeNull());
  view.rerender({ frontendId: next.frontendId });
  await waitFor(() => expect(view.result.current.note.data).toBe('Next note'));
});

beforeEach(initializeCatalog);
