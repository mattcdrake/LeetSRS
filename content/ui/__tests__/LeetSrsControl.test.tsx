// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, expect, it, onTestFinished, vi } from 'vitest';
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
  await screen.findByText('Opens after each accepted solve.');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect((await readLearningDocument()).cards).toEqual({});
  expect((await readLearningDocument()).settings.openRatingAfterSolving).toBeUndefined();
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled());
  expect(screen.queryByText('Opens after each accepted solve.')).not.toBeInTheDocument();
});

it('retries failed saves once, retaining pending work and confirmation across panel dismissal', async () => {
  render(<LeetSrsControl />);
  const trigger = await screen.findByRole('button', { name: 'LeetSRS' });
  fireEvent.click(trigger);
  const good = await screen.findByRole('button', { name: 'Good' });
  await screen.findByText('Opens after each accepted solve.');
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
  const review = await screen.findByRole('link', { name: /^2\. Add Two Numbers Review/ });
  expect(review).toHaveAttribute('href', 'https://leetcode.com/problems/add-two-numbers/description/');
  expect(review).not.toHaveAttribute('target');
  expect(await screen.findByRole('link', { name: /^3\. Longest Substring Blind 75/ })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/longest-substring/description/'
  );
  expect(screen.queryByRole('link', { name: /Two Sum/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Good' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Saved');
  await screen.findByText('No other reviews due');
  expect(screen.getByRole('link', { name: /^3\. Longest Substring Blind 75/ })).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await background.setActiveRoadmap(null);
  fireEvent.click(trigger);
  await screen.findByText('No other reviews due');
  await waitFor(() => expect(screen.queryByText('Loading next roadmap problem…')).not.toBeInTheDocument());
  expect(screen.queryByText(/Blind 75/)).not.toBeInTheDocument();
});

it('undoes a save back to the rating view, and refuses once the card changed', async () => {
  render(<LeetSrsControl />);
  fireEvent.click(await screen.findByRole('button', { name: 'LeetSRS' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Good' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled());
  expect(screen.getByRole('group')).toHaveFocus();
  expect((await readLearningDocument()).cards).toEqual({});

  vi.spyOn(console, 'error').mockImplementation(() => {});
  fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
  const undo = await screen.findByRole('button', { name: 'Undo' });
  await background.saveNote('1', 'Changed after saving');
  fireEvent.click(undo);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not undo. The card changed after saving.');
  expect(screen.getByRole('status')).toHaveTextContent('Saved as Easy');
  expect((await readLearningDocument()).cards['1']?.fsrs.reps).toBe(1);
});

it('keeps the Up next and undo shortcuts the same before and after saving', async () => {
  await replaceLearningDocument(
    buildLearningDocument({
      settings: { language: 'en' },
      cards: { '2': createMockCard(State.New, { frontendId: '2' }) },
      activeRoadmapId: 'blind-75',
    })
  );
  const opened: string[] = [];
  const recordNavigation = (event: MouseEvent) => {
    const link = (event.target as Element).closest('a');
    if (!link) return;
    event.preventDefault();
    opened.push(link.href);
  };
  document.addEventListener('click', recordNavigation);
  onTestFinished(() => document.removeEventListener('click', recordNavigation));
  render(<LeetSrsControl />);
  fireEvent.click(await screen.findByRole('button', { name: 'LeetSRS' }));
  await screen.findByRole('link', { name: /^3\. Longest Substring Blind 75/ });
  const panel = screen.getByRole('group');
  fireEvent.keyDown(panel, { key: 'r', code: 'KeyR' });
  expect(opened).toEqual(['https://leetcode.com/problems/add-two-numbers/description/']);
  fireEvent.keyDown(panel, { key: 'u', code: 'KeyU' });
  expect(screen.getByRole('button', { name: 'Good' })).toBeInTheDocument();

  fireEvent.keyDown(panel, { key: '3', code: 'Digit3' });
  await screen.findByRole('button', { name: 'Undo' });
  fireEvent.keyDown(panel, { key: 'n', code: 'KeyN' });
  expect(opened.at(-1)).toBe('https://leetcode.com/problems/longest-substring/description/');
  fireEvent.keyDown(panel, { key: 'u', code: 'KeyU' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled());
  expect((await readLearningDocument()).cards['1']).toBeUndefined();
});
