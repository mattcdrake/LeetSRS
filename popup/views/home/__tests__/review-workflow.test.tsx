/** @vitest-environment happy-dom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import backgroundEntry from '@/entrypoints/background/index';
import { CardsView } from '@/popup/views/card/CardsView';
import { DataSection } from '@/popup/views/settings/DataSection';
import { background } from '@/shared/background-service';
import { formatLocalDate } from '@/shared/calendar';
import { readLearningDocument } from '@/shared/storage';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewQueue } from '../ReviewQueue';

vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));
vi.mock('@/shared/background-service');

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2024-03-15T12:00:00'));
  backgroundEntry.main();
  createServiceMock(background).reset().use(getRegisteredBackground());
  await background.addCard(buildProblem());
  await background.addCard(buildProblem({ frontendId: '2' }));
});

afterEach(() => vi.useRealTimers());

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

it('saves and reopens a note, retries a failed review, persists scheduling and advances to the next card', async () => {
  const { wrapper } = createPopupTestWrapper();
  const view = render(<ReviewQueue />, { wrapper });
  await screen.findByText('Two Sum');
  click('Notes');
  const input = screen.getByRole('textbox', { name: 'Note text' });
  await waitFor(() => expect(input).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.change(input, { target: { value: 'Use a map' } });
  click('Notes');
  expect(input).not.toBeVisible();
  click('Notes');
  expect(input).toHaveValue('Use a map');

  const before = await readLearningDocument();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Disk unavailable'));
  click('Save');
  expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is kept');
  expect(await readLearningDocument()).toEqual(before);
  expect(input).toHaveValue('Use a map');
  const pending = Promise.withResolvers<void>();
  vi.mocked(fakeBrowser.storage.local.set).mockRestore();
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementationOnce(async (items) => {
    await pending.promise;
    await write(items);
  });
  click('Save');
  expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
  click('Notes');
  await act(async () => pending.resolve());
  await waitFor(async () => expect((await readLearningDocument()).cards['1'].note).toBe('Use a map'));
  click('Notes');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
  expect((await readLearningDocument()).cards['1'].note).toBe('Use a map');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  view.unmount();

  const list = render(<CardsView />, { wrapper });
  fireEvent.click(await screen.findByRole('button', { name: /#1 Two Sum/ }));
  expect(await screen.findByRole('textbox', { name: 'Note text' })).toHaveValue('Use a map');
  list.unmount();
  render(<ReviewQueue />, { wrapper });
  await screen.findByText('Two Sum');
  const saved = await readLearningDocument();
  vi.mocked(fakeBrowser.storage.local.set).mockRejectedValueOnce(new Error('Disk unavailable'));
  click('Good');
  await waitFor(() => expect(console.error).toHaveBeenCalledWith('Failed to rate card:', expect.any(Error)));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled());
  expect(await readLearningDocument()).toEqual(saved);
  click('Good');
  await screen.findByText('Add Two Numbers');
  const reviewed = await readLearningDocument();
  expect(reviewed.cards['1']).toMatchObject({ note: 'Use a map', fsrs: { reps: 1 } });
  expect(reviewed.cards['1'].fsrs.due).toBeGreaterThan(saved.cards['1'].fsrs.due);
  expect(reviewed.cards['1'].fsrs.last_review).toBeTypeOf('number');
  expect(reviewed.reviewActivity).toEqual({ date: formatLocalDate(new Date()), newCards: 1, streak: 1 });
  expect(reviewed.dataUpdatedAt).toBe(new Date(reviewed.cards['1'].fsrs.last_review ?? 0).toISOString());
});

it('pauses, resumes and deletes through real card controls, requiring confirmation', async () => {
  const { wrapper } = createPopupTestWrapper();
  const queue = render(<ReviewQueue />, { wrapper });
  await screen.findByText('Two Sum');
  click('Actions');
  click('Pause card');
  await screen.findByText('Add Two Numbers');
  expect((await readLearningDocument()).cards['1'].paused).toBe(true);
  queue.unmount();

  const list = render(<CardsView />, { wrapper });
  await screen.findByRole('button', { name: /#1 Two Sum/ });
  const search = screen.getByPlaceholderText('Filter by name or ID...');
  fireEvent.change(search, { target: { value: '2' } });
  expect(screen.getByText('Add Two Numbers')).toBeInTheDocument();
  expect(screen.queryByText('Two Sum')).not.toBeInTheDocument();
  click('Clear filter');
  click('Paused');
  expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'MISSING' } });
  expect(screen.getByText('No cards match your filter.')).toBeInTheDocument();
  click('Clear filter');
  fireEvent.change(search, { target: { value: 'tWo SuM' } });
  fireEvent.click(screen.getByRole('button', { name: /#1 Two Sum/ }));
  click('Resume');
  await waitFor(() => expect(screen.queryByText('Two Sum')).not.toBeInTheDocument());
  expect((await readLearningDocument()).cards['1'].paused).toBe(false);
  click('Paused');
  fireEvent.click(screen.getByRole('button', { name: /#1 Two Sum/ }));
  await screen.findByRole('button', { name: 'Pause' });
  expect((await readLearningDocument()).cards['1'].paused).toBe(false);
  click('Delete');
  expect((await readLearningDocument()).cards['1']).toBeDefined();
  click('Confirm?');
  await waitFor(() => expect(screen.queryByText('Two Sum')).not.toBeInTheDocument());
  expect((await readLearningDocument()).cards['1']).toBeUndefined();
  list.unmount();

  render(<ReviewQueue />, { wrapper });
  await screen.findByText('Add Two Numbers');
  click('Actions');
  click('Delete Card');
  expect((await readLearningDocument()).cards['2']).toBeDefined();
  click('Confirm Delete?');
  await screen.findByText('No cards to review!');
  expect((await readLearningDocument()).cards).toEqual({});
});

it('imports a replacement into the visible card list and resets it after cancellation and a failed write', async () => {
  await background.saveNote('1', 'Old note');
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  vi.stubGlobal('alert', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(
    <>
      <CardsView />
      <DataSection />
    </>,
    { wrapper: createPopupTestWrapper().wrapper }
  );
  fireEvent.click(await screen.findByRole('button', { name: /#1 Two Sum/ }));
  expect(await screen.findByRole('textbox', { name: 'Note text' })).toHaveValue('Old note');
  const saved = await readLearningDocument();
  const { note: _note, ...card } = saved.cards['1'];
  const replacement = buildLearningDocument({ cards: { '1': card }, dataUpdatedAt: '2099-01-01T00:00:00.000Z' });
  const file = new File([JSON.stringify(replacement)], 'backup.json', { type: 'application/json' });
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('Missing file input');
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveValue(''));
  await waitFor(() => expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument());
  expect(await readLearningDocument()).toEqual(replacement);
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  click('Reset…');
  expect(await readLearningDocument()).toEqual(replacement);
  vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Disk unavailable'));
  click('Reset…');
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to reset data'));
  expect(await readLearningDocument()).toEqual(replacement);
  click('Reset…');
  await waitFor(() => expect(screen.queryByText('Two Sum')).not.toBeInTheDocument());
  expect((await readLearningDocument()).cards).toEqual({});
});

it.each([
  ['2024-03-09T12:00:00', '2024-03-10T12:00:00', '1 Day', 23],
  ['2024-11-02T12:00:00', '2024-11-07T12:00:00', '5 Days', 121],
])('postpones a card across DST from %s to %s', async (start, end, action, hours) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(start));
  await background.resetAllData();
  await background.addCard(buildProblem());
  render(<ReviewQueue />, { wrapper: createPopupTestWrapper().wrapper });
  await screen.findByText('Two Sum');
  click('Actions');
  click(action);
  await screen.findByText('No cards to review!');
  const card = (await readLearningDocument()).cards['1'];
  expect(card.fsrs.due).toBe(new Date(end).getTime());
  expect(card.fsrs.due - new Date(start).getTime()).toBe(hours * 3_600_000);
});
