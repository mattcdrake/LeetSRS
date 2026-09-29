/** @vitest-environment happy-dom */
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import backgroundEntry from '@/entrypoints/background/index';
import { CardsView } from '@/popup/views/card/CardsView';
import { DataSection } from '@/popup/views/settings/DataSection';
import { background } from '@/shared/background-service';
import { gistConnectionItem, lastSyncTimeItem } from '@/shared/gist-sync';
import { readLearningDocument, replaceLearningDocument } from '@/shared/learning-document';
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

it('retains failed note drafts, retries saving and reopens the persisted note', async () => {
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
  click('Save');
  await waitFor(async () => expect((await readLearningDocument()).cards['1'].note).toBe('Use a map'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
  expect((await readLearningDocument()).cards['1'].note).toBe('Use a map');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  view.unmount();

  const list = render(<CardsView onBrowseRoadmaps={() => {}} />, { wrapper });
  fireEvent.click(await screen.findByRole('button', { name: /1\. Two Sum/ }));
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

it('pauses, resumes and deletes through real card controls, requiring confirmation', async () => {
  const { wrapper } = createPopupTestWrapper();
  const queue = render(<ReviewQueue />, { wrapper });
  await screen.findByText('Two Sum');
  click('Pause card');
  await screen.findByText('Add Two Numbers');
  expect((await readLearningDocument()).cards['1'].paused).toBe(true);
  queue.unmount();

  const list = render(<CardsView onBrowseRoadmaps={() => {}} />, { wrapper });
  await screen.findByRole('button', { name: /1\. Two Sum/ });
  fireEvent.click(screen.getByRole('button', { name: /^Paused/ }));
  expect(screen.queryByText('Add Two Numbers')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /1\. Two Sum/ }));
  click('Resume');
  await waitFor(() => expect(screen.queryByText('Two Sum')).not.toBeInTheDocument());
  expect((await readLearningDocument()).cards['1'].paused).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: /^Paused/ }));
  fireEvent.click(screen.getByRole('button', { name: /1\. Two Sum/ }));
  await screen.findByRole('button', { name: 'Pause' });
  expect((await readLearningDocument()).cards['1'].paused).toBe(false);
  click('Delete card');
  expect((await readLearningDocument()).cards['1']).toBeDefined();
  click('Confirm Delete?');
  await waitFor(() => expect(screen.queryByText('Two Sum')).not.toBeInTheDocument());
  expect((await readLearningDocument()).cards['1']).toBeUndefined();
  list.unmount();
});

it('keeps notes open across queue refreshes but binds delete confirmation to the current card', async () => {
  render(<ReviewQueue />, { wrapper: createPopupTestWrapper().wrapper });
  await screen.findByText('Two Sum');
  click('Notes');
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
  expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-expanded', 'true');
  click('Delete Card');
  expect((await readLearningDocument()).cards['2']).toBeDefined();
  click('Confirm Delete?');
  await screen.findByText('All caught up');
  expect((await readLearningDocument()).cards).toEqual({});
});

it('imports a replacement into the visible card list and resets it after cancellation and a failed write', async () => {
  await background.saveNote('1', 'Old note');
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  vi.stubGlobal('alert', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(
    <>
      <CardsView onBrowseRoadmaps={() => {}} />
      <DataSection />
    </>,
    { wrapper: createPopupTestWrapper().wrapper }
  );
  fireEvent.click(await screen.findByRole('button', { name: /1\. Two Sum/ }));
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
  click('Postpone review');
  fireEvent.click(await screen.findByRole('menuitem', { name: action }));
  await screen.findByText('All caught up');
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

it('disables all card controls and persists one review for duplicate actions while saving', async () => {
  render(<ReviewQueue />, { wrapper: createPopupTestWrapper().wrapper });
  await screen.findByText('Two Sum');
  click('Notes');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft' } });
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
