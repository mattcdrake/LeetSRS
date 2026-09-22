/** @vitest-environment happy-dom */

import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { ROADMAP_IDS } from '@/shared/roadmap';
import { readLearningDocument, writePopupDialogAcknowledgments } from '@/shared/storage';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem } from '@/test/utils/card-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { PopupRoot } from '../PopupRoot';
import { createPopupQueryClient } from '../query-client';

vi.hoisted(() => {
  vi.stubGlobal('__APP_VERSION__', 'test');
});
vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));
vi.mock('@/shared/background-service');

beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
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
  backgroundEntry.main();
  createServiceMock(background).reset().use(getRegisteredBackground());
  await background.waitForInitialization();
  await writePopupDialogAcknowledgments({ 'release-1.0': true });
});

const openPopup = () =>
  render(<PopupRoot queryClient={createPopupQueryClient({ defaultOptions: { queries: { retry: false } } })} />);

it('refreshes the Home badge immediately when adding a roadmap problem between clock ticks', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-17T10:00:00'));
  const popup = openPopup();
  try {
    await screen.findByText('No cards to review!');
    fireEvent.click(screen.getByLabelText('Roadmaps'));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Blind 75' }));
    fireEvent.click(await screen.findByRole('button', { name: /Arrays & Hashing/ }));
    expect(screen.getByLabelText('Home')).toHaveTextContent(/^Home$/);

    // The card is created after the popup clock's last tick.
    vi.setSystemTime(new Date('2026-09-17T10:00:01'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Two Sum' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save without rating' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText('Home')).toHaveTextContent(/^1Home$/));
  } finally {
    popup.unmount();
    vi.useRealTimers();
  }
});

it('browses, activates, filters, and restores a saved roadmap', async () => {
  await background.updateSettings({ preferredLeetcodeSite: 'leetcode.cn' });
  await background.rateCard({ ...buildProblem({ domain: 'leetcode.cn' }), rating: Rating.Good });
  const popup = openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  const overview = await screen.findByRole('region', { name: 'Blind 75' });
  expect(within(overview).getByText('1 / 75')).toBeInTheDocument();
  fireEvent.click(within(overview).getByRole('button', { name: 'Open Blind 75' }));

  const arrays = await screen.findByRole('button', { name: /Arrays & Hashing/ });
  expect(arrays).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(arrays);
  expect(screen.getByRole('link', { name: '1. 两数之和' })).toHaveAttribute(
    'href',
    'https://leetcode.cn/problems/two-sum/description/'
  );
  fireEvent.click(screen.getByRole('button', { name: /Sliding Window/ }));
  expect(screen.getByText('3. Longest Substring')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '3. Longest Substring' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
  await screen.findByRole('button', { name: 'Deactivate' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Search roadmap problems' }), { target: { value: 'Two Sum' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reviewed' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Skip 两数之和' }));
  await screen.findByRole('button', { name: 'Restore 两数之和' });
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
  popup.unmount();

  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  expect(await screen.findByRole('heading', { name: 'Blind 75' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Skipped' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore 两数之和' }));
  await screen.findByText('No matching problems.');
  await act(async () => background.removeCard('1'));
  await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0'));
  fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
  await screen.findByRole('button', { name: 'Activate' });
  expect(screen.getByRole('heading', { name: 'Blind 75' })).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Roadmaps'));
  expect(await screen.findByRole('button', { name: 'Use Blind 75' })).toBeInTheDocument();
});

it('keeps reviews available with roadmap progress and continues with a recommendation after the queue empties', async () => {
  await background.setActiveRoadmap('blind-75');
  await background.rateCard({ ...buildProblem(), rating: Rating.Easy });
  // This card is outside Blind 75 and must still be reviewable.
  await background.addCard(buildProblem({ frontendId: '2' }));
  openPopup();
  expect(await screen.findByRole('button', { name: 'Good' })).toBeEnabled();
  expect(screen.getByRole('link', { name: 'LeetCode problem' })).toHaveTextContent('Add Two Numbers');
  const section = await screen.findByRole('region', { name: 'Current roadmap' });
  expect(await within(section).findByText('1 / 75 reviewed')).toBeInTheDocument();
  expect(await within(section).findByRole('link', { name: '3. Longest Substring' })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/longest-substring/description/'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
  await screen.findByText('No cards to review!');
  expect(within(section).getByRole('link', { name: '3. Longest Substring' })).toBeInTheDocument();

  await act(async () => background.addCard(buildProblem({ frontendId: '3' })));
  await within(section).findByText('No unadded, unskipped problems available on leetcode.com.');
  // Unreviewed cards are excluded from recommendations without counting as progress.
  expect(within(section).getByText('1 / 75 reviewed')).toBeInTheDocument();
  await act(async () => background.removeCard('1'));
  expect(await within(section).findByRole('link', { name: '1. Two Sum' })).toBeInTheDocument();
  expect(within(section).getByText('0 / 75 reviewed')).toBeInTheDocument();

  fireEvent.click(within(section).getByRole('button', { name: 'View roadmap' }));
  expect(await screen.findByRole('heading', { name: 'Blind 75' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to all roadmaps' }));
  expect(within(await screen.findByRole('region', { name: 'Blind 75' })).getByText('Active')).toBeInTheDocument();
});

it('updates empty-queue recommendations for skips, the preferred site, and the active roadmap', async () => {
  openPopup();
  await screen.findByText('No cards to review!');
  expect(screen.queryByRole('region', { name: 'Current roadmap' })).not.toBeInTheDocument();
  await act(async () => background.setActiveRoadmap('blind-75'));
  const section = await screen.findByRole('region', { name: 'Current roadmap' });
  expect(await within(section).findByRole('link', { name: '1. Two Sum' })).toBeInTheDocument();
  await act(async () => background.setRoadmapProblemSkipped('blind-75', '1', true));
  expect(await within(section).findByRole('link', { name: '3. Longest Substring' })).toBeInTheDocument();
  expect(within(section).getByText('0 / 75 reviewed')).toBeInTheDocument();

  await act(async () => background.updateSettings({ preferredLeetcodeSite: 'leetcode.cn' }));
  await within(section).findByText('No unadded, unskipped problems available on leetcode.cn.');
  expect(within(section).queryByRole('link')).not.toBeInTheDocument();
  await act(async () => background.setRoadmapProblemSkipped('blind-75', '1', false));
  expect(await within(section).findByRole('link', { name: '1. 两数之和' })).toHaveAttribute(
    'href',
    'https://leetcode.cn/problems/two-sum/description/'
  );

  await act(async () => background.setRoadmapProblemSkipped('blind-75', '1', true));
  await within(section).findByText('No unadded, unskipped problems available on leetcode.cn.');
  await act(async () => background.setActiveRoadmap('grind-75'));
  expect(await within(section).findByText('Grind 75')).toBeInTheDocument();
  expect(await within(section).findByRole('link', { name: '1. 两数之和' })).toBeInTheDocument();
  await act(async () => background.setActiveRoadmap(null));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Current roadmap' })).not.toBeInTheDocument());
  expect(screen.getByText('No cards to review!')).toBeInTheDocument();
});

it('keeps reviews usable and retries when roadmap loading fails', async () => {
  await background.setActiveRoadmap('blind-75');
  await background.addCard(buildProblem());
  vi.mocked(fetch).mockRejectedValueOnce(new Error('Roadmap unavailable'));
  openPopup();
  expect(await screen.findByRole('button', { name: 'Good' })).toBeEnabled();
  const section = await screen.findByRole('region', { name: 'Current roadmap' });
  expect(await within(section).findByRole('alert')).toHaveTextContent('Failed to load roadmaps.');
  fireEvent.click(within(section).getByRole('button', { name: 'Retry' }));
  expect(await within(section).findByRole('link', { name: '3. Longest Substring' })).toBeInTheDocument();
});

it('suggests activating a roadmap only when reviews and the active roadmap are both absent', async () => {
  await background.addCard(buildProblem());
  openPopup();
  await screen.findByRole('button', { name: 'Easy' });
  expect(screen.queryByRole('button', { name: 'roadmap' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
  await screen.findByText('No cards to review!');
  const roadmapLink = screen.getByRole('button', { name: 'roadmap' });
  expect(roadmapLink.closest('p')).toHaveTextContent('Activate a roadmap to find your next problem.');
  fireEvent.click(roadmapLink);
  fireEvent.click(await screen.findByRole('button', { name: 'Use Blind 75' }));
  await screen.findByText('Active');
  fireEvent.click(screen.getByLabelText('Home'));
  await screen.findByText('No cards to review!');
  expect(screen.queryByRole('button', { name: 'roadmap' })).not.toBeInTheDocument();
});

it('rates new and saved roadmap problems and retains feedback when a filter removes the row', async () => {
  await background.updateSettings({ preferredLeetcodeSite: 'leetcode.cn' });
  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  fireEvent.click(await screen.findByRole('button', { name: 'Open Blind 75' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Not in SRS' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save 两数之和' }));
  let menu = await screen.findByRole('dialog', { name: 'Save 两数之和' });
  const good = within(menu).getByRole('button', { name: 'Good' });
  await waitFor(() => expect(good).toBeEnabled());
  fireEvent.click(good);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Save 两数之和' })).not.toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent('两数之和 · Saved · Review in');
  expect((await readLearningDocument()).cards['1']).toMatchObject({ domain: 'leetcode.cn', fsrs: { reps: 1 } });

  fireEvent.click(screen.getByRole('button', { name: 'Not in SRS' }));
  fireEvent.click(await screen.findByRole('button', { name: /Arrays & Hashing/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save 两数之和' }));
  menu = await screen.findByRole('dialog', { name: 'Save 两数之和' });
  expect(within(menu).queryByRole('button', { name: 'Save without rating' })).not.toBeInTheDocument();
  const easy = within(menu).getByRole('button', { name: 'Easy' });
  await waitFor(() => expect(easy).toBeEnabled());
  fireEvent.click(easy);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect((await readLearningDocument()).cards['1'].fsrs.reps).toBe(2);
});

it('keeps an in-flight Home rating attached to the original suggestion and prevents duplicate reviews', async () => {
  await background.setActiveRoadmap('blind-75');
  const completion = Promise.withResolvers<void>();
  vi.mocked(background.rateCard).mockImplementationOnce(async (input) => {
    const card = await getRegisteredBackground().rateCard(input);
    await completion.promise;
    return card;
  });
  openPopup();
  fireEvent.click(await screen.findByRole('button', { name: 'Save Two Sum' }));
  const menu = await screen.findByRole('dialog', { name: 'Save Two Sum' });
  const good = within(menu).getByRole('button', { name: 'Good' });
  await waitFor(() => expect(good).toBeEnabled());
  fireEvent.click(good);
  fireEvent.click(good);
  expect(await screen.findByText('3. Longest Substring')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Save Two Sum');
  expect(good).toBeDisabled();
  expect(background.rateCard).toHaveBeenCalledTimes(1);
  await act(async () => completion.resolve());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const section = screen.getByRole('region', { name: 'Current roadmap' });
  expect(within(section).getByRole('status')).toHaveTextContent('Two Sum · Saved · Review in');
  expect((await readLearningDocument()).cards['3']).toBeUndefined();
});

it('skips Home suggestions and retries failures without adding cards', async () => {
  await background.setActiveRoadmap('blind-75');
  vi.mocked(background.setRoadmapProblemSkipped).mockRejectedValueOnce(new Error('Storage unavailable'));
  openPopup();
  const section = await screen.findByRole('region', { name: 'Current roadmap' });
  const skip = await within(section).findByRole('button', { name: 'Skip Two Sum' });
  fireEvent.click(skip);
  expect(await within(section).findByRole('alert')).toHaveTextContent('Could not save skipped problems.');
  expect(within(section).getByRole('link', { name: '1. Two Sum' })).toBeInTheDocument();
  fireEvent.click(skip);
  const skipNext = await within(section).findByRole('button', { name: 'Skip Longest Substring' });
  await waitFor(() => expect(skipNext).toBeEnabled());
  fireEvent.click(skipNext);
  expect(
    await within(section).findByText('No unadded, unskipped problems available on leetcode.com.')
  ).toBeInTheDocument();
  expect((await readLearningDocument()).roadmapSkips['blind-75']).toEqual(['1', '3']);
  expect(background.addCard).not.toHaveBeenCalled();
  expect(background.rateCard).not.toHaveBeenCalled();
});
