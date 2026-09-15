import { NoteEditor } from '@/popup/components/notes/NoteEditor';
/**
 * @vitest-environment happy-dom
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { requireDefined } from '@/test/utils/assertions';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useCards, useDelayCardMutation, useRemoveCardMutation, useReviewQueueQuery } from '../cards';
import { useImportDataMutation, useResetAllDataMutation } from '../data';
import { useNoteQuery, useSaveNoteMutation } from '../notes';
import { useSettingsQuery } from '../settings';

vi.mock('@webext-core/proxy-service');
vi.mock('@/shared/background-service');

const problem = buildProblem();

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  backgroundEntry.main();
  const service = createServiceMock(background).reset();
  service.use(getRegisteredBackground());
  await background.addCard(problem);
});

describe('note and card query coherence', () => {
  it('refreshes the card list, review queue, and note after saving and deleting by slug', async () => {
    const { result } = renderHook(
      () => ({
        note: useNoteQuery(problem.frontendId),
        cards: useCards(),
        queue: useReviewQueueQuery(),
        save: useSaveNoteMutation(problem.frontendId),
      }),
      { wrapper: createPopupTestWrapper().wrapper }
    );
    await waitFor(() => expect(result.current.note.isSuccess).toBe(true));
    expect(result.current.note.data).toBeNull();

    await act(() => result.current.save.mutateAsync('  Use a map  '));
    expect(background.saveNote).toHaveBeenCalledWith(problem.frontendId, '  Use a map  ');
    await waitFor(() => {
      expect(result.current.note.data).toBe('  Use a map  ');
      expect(result.current.cards.data).toMatchObject([{ frontendId: problem.frontendId, note: '  Use a map  ' }]);
      expect(result.current.queue.data).toMatchObject([{ frontendId: problem.frontendId, note: '  Use a map  ' }]);
    });
    await act(() => result.current.save.mutateAsync(''));
    expect(background.saveNote).toHaveBeenCalledWith(problem.frontendId, '');
    await waitFor(() => {
      expect(result.current.note.data).toBeNull();
      expect(result.current.cards.data?.[0]).not.toHaveProperty('note');
      expect(result.current.queue.data?.[0]).not.toHaveProperty('note');
    });
  });

  it.each(['remove', 'import', 'reset'] as const)('clears a cached note after %s', async (operation) => {
    await background.saveNote(problem.frontendId, 'Previous note');
    const { result } = renderHook(
      () => ({
        note: useNoteQuery(problem.frontendId),
        cards: useCards(),
        queue: useReviewQueueQuery(),
        settings: useSettingsQuery(),
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
            ...buildLearningDocument({
              cards: { [problem.frontendId]: replacement },
              settings: { maxNewCardsPerDay: 0 },
            }),
          })
        );
    });
    await waitFor(() => {
      expect(result.current.note.data).toBeNull();
      expect(result.current.cards.data).toEqual(operation === 'import' ? [replacement] : []);
      expect(result.current.queue.data).toEqual([]);
      if (operation === 'import') expect(result.current.settings.data.maxNewCardsPerDay).toBe(0);
    });
  });
});

it('preserves a dirty rendered note through incoming replacement and saves its draft', async () => {
  await background.saveNote(problem.frontendId, 'Original');
  render(<NoteEditor frontendId={problem.frontendId} variant="regular" />, {
    wrapper: createPopupTestWrapper().wrapper,
  });
  const input = screen.getByRole('textbox', { name: 'Note text' });
  await waitFor(() => expect(input).toHaveValue('Original'));
  await act(() => background.saveNote(problem.frontendId, 'Untouched update'));
  await waitFor(() => expect(input).toHaveValue('Untouched update'));
  fireEvent.change(input, { target: { value: 'My draft' } });
  await act(() => background.saveNote(problem.frontendId, ''));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument());
  expect(input).toHaveValue('My draft');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
  expect(input).toHaveValue('My draft');
  await act(() => background.saveNote(problem.frontendId, 'Later update'));
  await waitFor(() => expect(input).toHaveValue('Later update'));
});

it('keeps the outgoing card note live after it leaves the review queue', async () => {
  const next = buildProblem({ frontendId: 'next-card' });
  await background.addCard(next);
  await background.saveNote(problem.frontendId, 'Outgoing note');
  await background.saveNote(next.frontendId, 'Next note');
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
  await act(() => background.saveNote(problem.frontendId, ''));
  await waitFor(() => expect(view.result.current.note.data).toBeNull());
  view.rerender({ frontendId: next.frontendId });
  await waitFor(() => expect(view.result.current.note.data).toBe('Next note'));
});
