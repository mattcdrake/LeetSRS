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
  const restoredGood = await screen.findByRole('button', { name: 'Good' });
  await waitFor(() => expect(restoredGood.closest('fieldset')).toHaveFocus());
  await waitFor(async () => expect((await readLearningDocument()).cards).toEqual({}));
});

it.each([3, 5])('limits shortcut %s to the open panel and ignores repeated presses', async (key) => {
  render(<LeetSrsControl />);
  fireEvent.keyDown(document.body, { key: String(key) });
  expect((await readLearningDocument()).cards).toEqual({});
  fireEvent.click(await screen.findByRole('button', { name: 'LeetSRS' }));
  const good = await screen.findByRole('button', { name: 'Good' });
  await waitFor(() => expect(good).toBeEnabled());
  fireEvent.keyDown(good, { key: String(key), repeat: true });
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

it('retains a save in progress and its confirmation when the panel closes and reopens', async () => {
  const release = Promise.withResolvers<void>();
  const service = createBackgroundService(Promise.resolve());
  vi.mocked(background.savePanelRating).mockImplementation(async (input) => {
    await release.promise;
    return service.savePanelRating(input);
  });
  render(<LeetSrsControl />);
  const trigger = await screen.findByRole('button', { name: 'LeetSRS' });
  fireEvent.click(trigger);
  await screen.findByText('Opens after you solve a problem.');
  fireEvent.click(screen.getByRole('button', { name: 'Good' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(trigger);
  await act(async () => release.resolve());
  expect(await screen.findByRole('status')).toHaveTextContent('Saved');
  fireEvent.keyDown(screen.getByRole('button', { name: 'Undo' }), { key: '3' });
  expect((await readLearningDocument()).cards['1']?.fsrs.reps).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(async () => expect((await readLearningDocument()).cards).toEqual({}));
});

it('does not consume the hint when the panel closes before it can be displayed', async () => {
  const release = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const service = createBackgroundService(Promise.resolve());
  vi.mocked(background.getRatingHint).mockImplementationOnce(async () => {
    started.resolve();
    await release.promise;
    return service.getRatingHint();
  });
  render(<LeetSrsControl />);
  const trigger = await screen.findByRole('button', { name: 'LeetSRS' });
  fireEvent.click(trigger);
  await act(() => started.promise);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await act(async () => release.resolve());
  expect(await service.getRatingHint()).toBe(true);
  fireEvent.click(trigger);
  await screen.findByText('Opens after you solve a problem.');
  await waitFor(async () => expect(await service.getRatingHint()).toBe(false));
});

it('closes saved confirmations after five seconds and allows another manual rating', async () => {
  await replaceLearningDocument(buildLearningDocument({ settings: { language: 'en', openRatingAfterSolving: false } }));
  render(<LeetSrsControl />);
  const trigger = await screen.findByRole('button', { name: 'LeetSRS' });
  for (const reps of [1, 2]) {
    fireEvent.click(trigger);
    const good = await screen.findByRole('button', { name: 'Good' });
    await waitFor(() => expect(good).toBeEnabled());
    vi.useFakeTimers();
    try {
      await act(async () => fireEvent.click(good));
      expect(good).toHaveAttribute('data-selected', 'true');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(400));
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(4599));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect((await readLearningDocument()).cards['1']?.fsrs.reps).toBe(reps);
    } finally {
      vi.useRealTimers();
    }
  }
});
