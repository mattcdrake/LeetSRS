/** @vitest-environment happy-dom */
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import backgroundEntry from '@/entrypoints/background/index';
import { NoteEditor } from '@/popup/components/notes/NoteEditor';
import { CardsView } from '@/popup/views/card/CardsView';
import { DataSection } from '@/popup/views/settings/DataSection';
import { background } from '@/shared/background-service';
import { gistConnectionItem, lastSyncTimeItem } from '@/shared/gist-sync';
import { learningDocumentItem, readLearningDocument, replaceLearningDocument } from '@/shared/learning-document';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { seedGithubAuthorization } from '@/test/utils/github-auth';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { ReviewQueue } from '../ReviewQueue';

vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));
vi.mock('@/shared/background-service');

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.stubEnv('TZ', 'America/Los_Angeles');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2024-03-15T12:00:00'));
  backgroundEntry.main();
  createServiceMock(background).reset().use(getRegisteredBackground());
  await background.addCard(buildProblem());
  await background.addCard(buildProblem({ frontendId: '2' }));
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

it('retains failed note drafts, retries a pending save and reopens the persisted note', async () => {
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
});

it('retries a failed review, persists scheduling and advances to the next card', async () => {
  await background.saveNote('1', 'Use a map');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { wrapper } = createPopupTestWrapper();
  vi.spyOn(fakeBrowser.storage.local, 'set');
  render(<ReviewQueue />, { wrapper });
  await screen.findByText('Two Sum');
  const saved = await readLearningDocument();
  vi.mocked(fakeBrowser.storage.local.set).mockRejectedValueOnce(new Error('Disk unavailable'));
  click('Good');
  await waitFor(() => expect(console.error).toHaveBeenCalledWith('Failed to update card:', expect.any(Error)));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled());
  expect(await readLearningDocument()).toEqual(saved);
  click('Good');
  await screen.findByText('Add Two Numbers');
  expect((await readLearningDocument()).cards['1']).toMatchObject({ note: 'Use a map', fsrs: { reps: 1 } });
});

it('pauses, resumes and retries deletion through real card controls, requiring confirmation', async () => {
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
  click('Paused');
  expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument();
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
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Disk unavailable'));
  click('Confirm?');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
  expect((await readLearningDocument()).cards['1']).toBeDefined();
  click('Delete');
  click('Confirm?');
  await waitFor(() => expect(screen.queryByText('Two Sum')).not.toBeInTheDocument());
  expect((await readLearningDocument()).cards['1']).toBeUndefined();
  list.unmount();
});

it('keeps expansion across queue refreshes but binds delete confirmation to the current card', async () => {
  render(<ReviewQueue />, { wrapper: createPopupTestWrapper().wrapper });
  await screen.findByText('Two Sum');
  click('Notes');
  click('Actions');
  click('Delete Card');

  const saved = await readLearningDocument();
  await replaceLearningDocument({
    ...saved,
    cards: { ...saved.cards, '1': { ...saved.cards['1'], note: 'Refreshed note' } },
  });
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveValue('Refreshed note'));
  expect(screen.getByRole('button', { name: 'Confirm Delete?' })).toBeVisible();

  await replaceLearningDocument({ ...saved, cards: { '2': saved.cards['2'] } });
  await screen.findByText('Add Two Numbers');
  expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute('aria-expanded', 'true');
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

it('exports the current complete snapshot, preserving its timestamp and excluding connection, status, and legacy values while offline', async () => {
  const document = buildLearningDocument({
    cards: { '1': createMockCard(State.Review, { frontendId: '1', paused: true, note: 'Keep this note' }) },
    reviewActivity: { date: '2024-01-01', newCards: 0, streak: 1 },
    settings: { theme: 'dark', maxNewCardsPerDay: 7, resetEditorOnReviewQueue: true },
    dataUpdatedAt: '2024-01-15T10:00:00.000Z',
  });
  await replaceLearningDocument(document);
  await storage.setItems([
    { item: gistConnectionItem, value: { accountId: 1, gistId: 'local-gist', enabled: true } },
    { item: lastSyncTimeItem, value: 'previous-sync' },
    { key: 'sync:leetsrs:theme', value: 'light' },
  ]);
  await seedGithubAuthorization();
  onlineManager.setOnline(false);
  const backups: Blob[] = [];
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    if (!(blob instanceof Blob)) throw new Error('Expected a backup blob');
    backups.push(blob);
    return 'blob:backup';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const downloads: { href: string; filename: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ href: this.href, filename: this.download });
  });
  render(<DataSection />, { wrapper: createPopupTestWrapper().wrapper });
  click('Export backup');
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
  expect(JSON.parse(await backups[0].text())).toEqual(document);
  expect(backups[0].type).toBe('application/json');
  expect(downloads).toEqual([{ href: 'blob:backup', filename: 'leetsrs-backup-2024-03-15.json' }]);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export backup' })).toBeEnabled());

  const replacement = buildLearningDocument();
  await replaceLearningDocument(replacement);
  click('Export backup');
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(2));
  expect(JSON.parse(await backups[1].text())).toEqual(replacement);
});

it('reports initialization failure when exporting unavailable data without creating an empty backup', async () => {
  await learningDocumentItem.removeValue();
  vi.mocked(background.waitForInitialization).mockRejectedValue(new Error('Initialization failed'));
  vi.stubGlobal('alert', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const createObjectURL = vi.spyOn(URL, 'createObjectURL');
  render(<DataSection />, { wrapper: createPopupTestWrapper().wrapper });
  click('Export backup');
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to export data'));
  expect(createObjectURL).not.toHaveBeenCalled();
  expect(await learningDocumentItem.getValue()).toBeNull();
});

it('validates changed notes and retries deletion without deleting the card', async () => {
  await background.saveNote('1', 'Stored note');
  render(<ReviewQueue />, { wrapper: createPopupTestWrapper().wrapper });
  await screen.findByText('Two Sum');
  click('Notes');
  const input = screen.getByRole('textbox', { name: 'Note text' });
  await waitFor(() => expect(input).toHaveValue('Stored note'));
  const save = screen.getByRole('button', { name: 'Save' });
  expect(save).toBeDisabled();
  for (const [value, enabled] of [
    ['Changed', true],
    ['', false],
    ['a'.repeat(500), true],
    ['a'.repeat(501), false],
    ['Stored note', false],
  ] as const) {
    fireEvent.change(input, { target: { value } });
    expect(save.hasAttribute('disabled')).toBe(!enabled);
    expect(screen.getByText(`${value.length}/500`)).toBeInTheDocument();
  }
  const before = await readLearningDocument();
  click('Delete');
  expect(await readLearningDocument()).toEqual(before);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Disk unavailable'));
  click('Confirm?');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
  expect(input).toHaveValue('Stored note');
  expect(await readLearningDocument()).toEqual(before);
  const pending = Promise.withResolvers<void>();
  vi.mocked(fakeBrowser.storage.local.set).mockRestore();
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementationOnce(async (items) => {
    await pending.promise;
    await write(items);
  });
  click('Delete');
  click('Confirm?');
  expect(await screen.findByRole('button', { name: 'Deleting...' })).toBeDisabled();
  expect(input).toBeDisabled();
  expect(save).toBeDisabled();
  await act(async () => pending.resolve());
  await waitFor(() => expect(input).toHaveValue(''));
  const { note: _note, ...card } = before.cards['1'];
  expect((await readLearningDocument()).cards['1']).toEqual(card);
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
});

it.each(['save', 'delete', 'failure'] as const)('isolates a note %s when switching cards', async (operation) => {
  await background.saveNote('1', 'Stored note');
  await background.saveNote('2', 'Other note');
  const view = render(<NoteEditor frontendId="1" variant="regular" />, { wrapper: createPopupTestWrapper().wrapper });
  const input = await screen.findByRole('textbox', { name: 'Note text' });
  await waitFor(() => expect(input).toHaveValue('Stored note'));
  const pending = Promise.withResolvers<void>();
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementationOnce(async (items) => {
    await pending.promise;
    await write(items);
  });
  fireEvent.change(input, { target: { value: 'Outgoing draft' } });
  if (operation === 'delete') {
    click('Delete');
    click('Confirm?');
  } else click('Save');
  expect(
    await screen.findByRole('button', { name: operation === 'delete' ? 'Deleting...' : 'Saving...' })
  ).toBeDisabled();
  expect(input).toBeDisabled();
  expect(screen.getByRole('button', { name: operation === 'delete' ? 'Save' : 'Delete' })).toBeDisabled();
  if (operation === 'failure') {
    await act(async () => pending.reject(new Error('Disk unavailable')));
    await screen.findByRole('alert');
  }
  view.rerender(<NoteEditor frontendId="2" variant="regular" />);
  const other = screen.getByRole('textbox', { name: 'Note text' });
  await waitFor(() => expect(other).toHaveValue('Other note'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.change(other, { target: { value: 'Other draft' } });
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  await act(async () => pending.resolve());
  expect(other).toHaveValue('Other draft');
  expect((await readLearningDocument()).cards['2'].note).toBe('Other note');
  expect((await readLearningDocument()).cards['1'].note).toBe(
    operation === 'delete' ? undefined : operation === 'save' ? 'Outgoing draft' : 'Stored note'
  );
});

it('disables all card controls and persists one review for duplicate actions while saving', async () => {
  render(<ReviewQueue />, { wrapper: createPopupTestWrapper().wrapper });
  await screen.findByText('Two Sum');
  click('Notes');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft' } });
  click('Actions');
  const controls = screen.getAllByRole('button');
  const pending = Promise.withResolvers<void>();
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementationOnce(async (items) => {
    await pending.promise;
    await write(items);
  });
  click('Good');
  await waitFor(() => {
    for (const control of controls) expect(control).toBeDisabled();
  });
  for (const control of controls) fireEvent.click(control);
  expect(screen.getByRole('textbox')).toBeDisabled();
  await act(async () => pending.resolve());
  await screen.findByText('Add Two Numbers');
  expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled();
  const saved = await readLearningDocument();
  expect(saved.cards['1']).toMatchObject({ paused: false, fsrs: { reps: 1 } });
  expect(saved.cards['1'].note).toBeUndefined();
  expect(saved.reviewActivity?.newCards).toBe(1);
});

it.each(['command', 'refresh'] as const)('waits for the pending %s before showing the next card', async (phase) => {
  const { wrapper, queryClient } = createPopupTestWrapper();
  render(<ReviewQueue />, { wrapper });
  await screen.findByText('Two Sum');
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  const pending = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const read = learningDocumentItem.getValue.bind(learningDocumentItem);
  const rate = getRegisteredBackground().rateCard;
  vi.mocked(background.rateCard).mockImplementationOnce(async (input) => {
    const card = await rate(input);
    if (phase === 'command') {
      started.resolve();
      await pending.promise;
    } else
      vi.spyOn(learningDocumentItem, 'getValue').mockImplementation(async () => {
        started.resolve();
        await pending.promise;
        return read();
      });
    return card;
  });
  click('Good');
  await act(() => started.promise);
  if (phase === 'command') await screen.findByText('Loading review queue...');
  else await waitFor(() => expect(screen.getByRole('button', { name: 'Good' })).toBeDisabled());
  expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument();
  await act(async () => pending.resolve());
  await screen.findByText('Add Two Numbers');
  expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled();
  expect((await readLearningDocument()).cards['1'].fsrs.reps).toBe(1);
});
