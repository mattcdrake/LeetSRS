// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createBackgroundService } from '@/background/service';
import { background } from '@/shared/background-service';
import { readLearningDocument, replaceLearningDocument } from '@/shared/storage';
import { requireDefined } from '@/test/utils/assertions';
import { testCatalog } from '@/test/utils/catalog-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { LeetSrsControl } from '../LeetSrsControl';

vi.mock('@/shared/background-service');
beforeEach(async () => {
  fakeBrowser.reset();
  window.history.replaceState({}, '', '/problems/two-sum/');
  await replaceLearningDocument(buildLearningDocument({ settings: { language: 'en' } }));
  createServiceMock(background)
    .use(createBackgroundService(Promise.resolve()))
    .resolve('getProblem', requireDefined(testCatalog[0]));
});

it('keeps the saved confirmation open and Undo restores the prior practice state', async () => {
  render(<LeetSrsControl />);
  fireEvent.click(await screen.findByRole('button', { name: 'LeetSRS' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Good' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Saved');
  expect((await readLearningDocument()).cards['1']?.fsrs.reps).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await screen.findByRole('button', { name: 'Good' });
  await waitFor(async () => expect((await readLearningDocument()).cards).toEqual({}));
});

it.each([1, 2, 3, 4, 5])('limits shortcut %s to the open panel and ignores repeated presses', async (key) => {
  render(<LeetSrsControl />);
  fireEvent.keyDown(document.body, { key: String(key) });
  expect((await readLearningDocument()).cards).toEqual({});
  fireEvent.click(await screen.findByRole('button', { name: 'LeetSRS' }));
  const good = await screen.findByRole('button', { name: 'Good' });
  await waitFor(() => expect(good).toBeEnabled());
  const dialog = screen.getByRole('dialog');
  fireEvent.keyDown(dialog, { key: String(key), repeat: true });
  expect((await readLearningDocument()).cards).toEqual({});
  fireEvent.keyDown(good, { key: String(key) });
  fireEvent.keyDown(good, { key: String(key) });
  await screen.findByRole('button', { name: 'Undo' });
  expect((await readLearningDocument()).cards['1']?.fsrs.reps).toBe(key === 5 ? 0 : 1);
});

it('Escape restores focus without saving or disabling auto-open, and the hint appears only once', async () => {
  render(<LeetSrsControl />);
  const trigger = await screen.findByRole('button', { name: 'LeetSRS' });
  fireEvent.click(trigger);
  await screen.findByText('Opens after you solve a problem.');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect((await readLearningDocument()).cards).toEqual({});
  expect((await readLearningDocument()).settings.openRatingAfterSolving).toBeUndefined();
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled());
  expect(screen.queryByText('Opens after you solve a problem.')).not.toBeInTheDocument();
});

it('persists opt-out and keeps manual opening available', async () => {
  render(<LeetSrsControl />);
  const trigger = await screen.findByRole('button', { name: 'LeetSRS' });
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole('button', { name: 'Turn off auto-open' }));
  await waitFor(async () => expect((await readLearningDocument()).settings.openRatingAfterSolving).toBe(false));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled());
});

it('keeps persistence failures retryable and prevents saving twice while pending', async () => {
  render(<LeetSrsControl />);
  fireEvent.click(await screen.findByRole('button', { name: 'LeetSRS' }));
  const good = await screen.findByRole('button', { name: 'Good' });
  await screen.findByText('Opens after you solve a problem.');
  vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Disk full'));
  fireEvent.click(good);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  expect((await readLearningDocument()).cards).toEqual({});
  const release = Promise.withResolvers<void>();
  const service = createBackgroundService(Promise.resolve());
  vi.mocked(background.savePanelRating).mockImplementation(async (input) => {
    await release.promise;
    return service.savePanelRating(input);
  });
  fireEvent.click(good);
  fireEvent.click(good);
  fireEvent.keyDown(good, { key: '3' });
  await act(async () => release.resolve());
  await screen.findByRole('button', { name: 'Undo' });
  expect((await readLearningDocument()).cards['1']?.fsrs.reps).toBe(1);
  vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Disk full'));
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not undo');
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(async () => expect((await readLearningDocument()).cards).toEqual({}));
});

it.each(['light', 'dark'])('shows descriptions and actual intervals in the %s theme', async (theme) => {
  document.documentElement.className = theme;
  render(<LeetSrsControl />);
  fireEvent.click(await screen.findByRole('button', { name: 'LeetSRS' }));
  const good = await screen.findByRole('button', { name: 'Good' });
  await waitFor(() => expect(good).toHaveTextContent('3 days'));
  expect(good).toHaveAccessibleDescription('Recalled the approach');
  expect(good.closest('[data-theme]')).toHaveAttribute('data-theme', theme);
  document.documentElement.className = '';
});
