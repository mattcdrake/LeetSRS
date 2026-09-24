import { NoteEditor } from '@/popup/components/notes/NoteEditor';
/**
 * @vitest-environment happy-dom
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import * as catalog from '@/shared/catalog';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem } from '@/test/utils/card-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useDelayCardMutation, useReviewQueueQuery } from '../cards';
import { useNoteQuery, useSaveNoteMutation } from '../notes';

vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));
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
  const lookups = vi.spyOn(catalog, 'getProblemsByFrontendIds');
  const next = buildProblem({ frontendId: 'next-card' });
  await background.addCard(next);
  await background.saveNote(problem.frontendId, 'Outgoing note');
  await background.saveNote(next.frontendId, 'Next note');
  const view = renderHook(
    ({ frontendId }) => ({
      note: useNoteQuery(frontendId),
      queue: useReviewQueueQuery(),
      delay: useDelayCardMutation(),
      save: useSaveNoteMutation(frontendId),
    }),
    { initialProps: { frontendId: problem.frontendId }, wrapper: createPopupTestWrapper().wrapper }
  );
  await waitFor(() => expect(view.result.current.note.data).toBe('Outgoing note'));
  await act(() => view.result.current.delay.mutateAsync({ frontendId: problem.frontendId, days: 1 }));
  await waitFor(() => expect(view.result.current.queue.data).toMatchObject([{ frontendId: next.frontendId }]));
  expect(view.result.current.note.data).toBe('Outgoing note');
  await act(() => view.result.current.save.mutateAsync(''));
  await waitFor(() => expect(view.result.current.note.data).toBeNull());
  view.rerender({ frontendId: next.frontendId });
  await waitFor(() => expect(view.result.current.note.data).toBe('Next note'));
  expect(view.result.current.queue.data).toMatchObject([{ note: 'Next note' }]);
  expect(lookups).toHaveBeenCalledTimes(1);
});
