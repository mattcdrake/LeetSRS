// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createBackgroundService } from '@/background/service';
import { background } from '@/shared/background-service';
import { readLearningDocument, replaceLearningDocument } from '@/shared/learning-document';
import { ROADMAP_IDS } from '@/shared/roadmap';
import { requireDefined } from '@/test/utils/assertions';
import { createMockCard } from '@/test/utils/card-mocks';
import { testCatalog } from '@/test/utils/catalog-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { LeetSrsControl } from '../LeetSrsControl';

vi.mock('@/shared/background-service');
beforeEach(async () => {
  fakeBrowser.reset();
  const fetchCatalog = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>((input, init) => {
      const id = ROADMAP_IDS.find((id) => input === fakeBrowser.runtime.getURL(`/data/roadmaps/${id}.json`));
      return id
        ? Promise.resolve(Response.json(JSON.parse(readFileSync(`public/data/roadmaps/${id}.json`, 'utf8'))))
        : fetchCatalog(input, init);
    })
  );
  window.history.replaceState({}, '', '/problems/two-sum/');
  await replaceLearningDocument(buildLearningDocument({ settings: { language: 'en' } }));
  createServiceMock(background)
    .use(createBackgroundService(Promise.resolve()))
    .resolve('getProblem', requireDefined(testCatalog[0]));
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
  await screen.findByRole('status');
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

it('retries failed saves once, retaining pending work and confirmation across panel dismissal', async () => {
  render(<LeetSrsControl />);
  const trigger = await screen.findByRole('button', { name: 'LeetSRS' });
  fireEvent.click(trigger);
  const good = await screen.findByRole('button', { name: 'Good' });
  await screen.findByText('Opens after you solve a problem.');
  vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Disk full'));
  fireEvent.click(good);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  expect((await readLearningDocument()).cards).toEqual({});
  const release = Promise.withResolvers<void>();
  const service = createBackgroundService(Promise.resolve());
  vi.mocked(background.rateCard).mockImplementation(async (input) => {
    await release.promise;
    return service.rateCard(input);
  });
  // The error can render before the effect clears the selected rating.
  await waitFor(() => expect(good).toBeEnabled());
  fireEvent.click(good);
  fireEvent.click(good);
  fireEvent.keyDown(good, { key: '3' });
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(trigger);
  await act(async () => release.resolve());
  expect(await screen.findByRole('status')).toHaveTextContent('Saved');
  fireEvent.keyDown(screen.getByRole('status'), { key: '3' });
  expect((await readLearningDocument()).cards['1']?.fsrs.reps).toBe(1);
});

it('does not consume the hint when the panel closes before it can be displayed', async () => {
  const release = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const service = createBackgroundService(Promise.resolve());
  vi.mocked(background.shouldShowAutoOpenHint).mockImplementationOnce(async () => {
    started.resolve();
    await release.promise;
    return service.shouldShowAutoOpenHint();
  });
  render(<LeetSrsControl />);
  const trigger = await screen.findByRole('button', { name: 'LeetSRS' });
  fireEvent.click(trigger);
  await act(() => started.promise);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await act(async () => release.resolve());
  expect(await service.shouldShowAutoOpenHint()).toBe(true);
  fireEvent.click(trigger);
  await screen.findByText('Opens after you solve a problem.');
  await waitFor(async () => expect(await service.shouldShowAutoOpenHint()).toBe(false));
});

it('keeps saved confirmations open until dismissed and allows another manual rating', async () => {
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
      expect(screen.getByRole('status')).toHaveTextContent('Saved');
      await act(() => vi.advanceTimersByTimeAsync(6000));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect((await readLearningDocument()).cards['1']?.fsrs.reps).toBe(reps);
    } finally {
      vi.useRealTimers();
    }
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  }
});

it('shows next problems before rating and refreshes the daily allowance after saving', async () => {
  await replaceLearningDocument(
    buildLearningDocument({
      settings: { language: 'en', maxNewCardsPerDay: 1 },
      cards: { '2': createMockCard(State.New, { frontendId: '2' }) },
      activeRoadmapId: 'blind-75',
    })
  );
  render(<LeetSrsControl />);
  const trigger = await screen.findByRole('button', { name: 'LeetSRS' });
  fireEvent.click(trigger);
  const review = await screen.findByRole('link', { name: 'Next review 2. Add Two Numbers' });
  expect(review).toHaveAttribute('href', 'https://leetcode.com/problems/add-two-numbers/description/');
  expect(review).not.toHaveAttribute('target');
  expect(await screen.findByRole('link', { name: 'Next in Blind 75 3. Longest Substring' })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/longest-substring/description/'
  );
  expect(screen.queryByRole('link', { name: /Two Sum/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Good' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Saved');
  await screen.findByText('No other reviews due');
  expect(screen.getByRole('link', { name: 'Next in Blind 75 3. Longest Substring' })).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await background.setActiveRoadmap(null);
  fireEvent.click(trigger);
  await screen.findByText('No other reviews due');
  await waitFor(() => expect(screen.queryByText('Loading next roadmap problem…')).not.toBeInTheDocument());
  expect(screen.queryByText(/Blind 75/)).not.toBeInTheDocument();
});

it('keeps rating and reviews usable when roadmap loading fails, then retries', async () => {
  await replaceLearningDocument(
    buildLearningDocument({
      settings: { language: 'en' },
      cards: { '2': createMockCard(State.Review, { frontendId: '2' }) },
      activeRoadmapId: 'blind-75',
    })
  );
  vi.mocked(background.getNextRoadmapProblem).mockRejectedValueOnce(new Error('Unavailable'));
  render(<LeetSrsControl />);
  fireEvent.click(await screen.findByRole('button', { name: 'LeetSRS' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the next roadmap problem.');
  expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled();
  expect(await screen.findByRole('link', { name: 'Next review 2. Add Two Numbers' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('link', { name: 'Next in Blind 75 3. Longest Substring' })).toBeInTheDocument();
});
