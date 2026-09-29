import { NoteEditor } from '@/popup/components/notes/NoteEditor';
/**
 * @vitest-environment happy-dom
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { readLearningDocument } from '@/shared/learning-document';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem } from '@/test/utils/card-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';

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

it('deletes only the note after confirmation', async () => {
  await background.saveNote('1', 'Remove this note');
  const { note: _note, ...card } = (await readLearningDocument()).cards['1'];
  render(<NoteEditor frontendId="1" variant="regular" />, { wrapper: createPopupTestWrapper().wrapper });
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  expect((await readLearningDocument()).cards['1'].note).toBe('Remove this note');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm?' }));
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
  expect((await readLearningDocument()).cards['1']).toEqual(card);
});
