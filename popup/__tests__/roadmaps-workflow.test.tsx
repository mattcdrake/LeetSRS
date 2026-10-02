/** @vitest-environment happy-dom */

import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { readLearningDocument } from '@/shared/learning-document';
import { writePopupDialogAcknowledgments } from '@/shared/popup-dialogs';
import { ROADMAP_IDS } from '@/shared/roadmap';
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

async function selectFilter(current: string, next: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Filter: ${current}` }));
  fireEvent.click(await screen.findByRole('menuitemradio', { name: next }));
}

async function chooseRowAction(title: string, action: string) {
  fireEvent.click(await screen.findByRole('button', { name: `More actions for ${title}` }));
  fireEvent.click(await screen.findByRole('menuitem', { name: action }));
}

it('refreshes the Home badge immediately when adding a roadmap problem between clock ticks', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-17T10:00:00'));
  const popup = openPopup();
  try {
    await screen.findByText('Start your first review');
    expect(screen.getByLabelText('Home')).toHaveTextContent(/^Home$/);
    fireEvent.click(screen.getByLabelText('Roadmaps'));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Blind 75' }));
    fireEvent.click(await screen.findByRole('button', { name: /Arrays & Hashing/ }));

    // The card is created after the popup clock's last tick.
    vi.setSystemTime(new Date('2026-09-17T10:00:01'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Two Sum to SRS' }));
    await waitFor(() => expect(screen.getByLabelText('Home')).toHaveTextContent(/^1$/));
    fireEvent.click(screen.getByLabelText('Home'));
    expect(screen.getByLabelText('Home')).toHaveTextContent(/^Home1$/);
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
  const overview = await screen.findByRole('region', { name: 'Choose a roadmap' });
  expect(within(overview).getByRole('progressbar', { name: 'Blind 75' })).toHaveAttribute('aria-valuenow', '1');
  fireEvent.click(within(overview).getByRole('button', { name: 'Open Blind 75' }));

  const arrays = await screen.findByRole('button', { name: /Arrays & Hashing/ });
  expect(arrays).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(arrays);
  expect(screen.getByRole('link', { name: '1. 两数之和' })).toHaveAttribute(
    'href',
    'https://leetcode.cn/problems/two-sum/description/'
  );
  fireEvent.click(screen.getByRole('button', { name: /Sliding Window/ }));
  const unavailable = screen.getByText('Longest Substring').closest('li') as HTMLElement;
  expect(within(unavailable).getByText('Unavailable on leetcode.cn')).toBeInTheDocument();
  expect(within(unavailable).queryByRole('link')).not.toBeInTheDocument();
  expect(within(unavailable).queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use Blind 75' }));
  await screen.findByRole('button', { name: 'Active' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Search roadmap problems' }), { target: { value: 'Two Sum' } });
  await selectFilter('All', 'Reviewed');
  expect(screen.getAllByRole('button', { name: /^More actions for/ })).toHaveLength(1);
  await chooseRowAction('两数之和', 'Skip');
  await screen.findByRole('button', { name: 'Restore 两数之和' });
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  popup.unmount();

  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  expect(await screen.findByRole('heading', { name: 'Blind 75' })).toBeInTheDocument();
  await selectFilter('All', 'Skipped');
  fireEvent.click(await screen.findByRole('button', { name: 'Restore 两数之和' }));
  await screen.findByText('No matching problems');
  await act(async () => background.removeCard('1'));
  await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0'));
});

it('keeps reviews available with roadmap progress and continues with a recommendation after the queue empties', async () => {
  await background.setActiveRoadmap('blind-75');
  await background.rateCard({ ...buildProblem(), rating: Rating.Easy });
  // This card is outside Blind 75 and must still be reviewable.
  await background.addCard(buildProblem({ frontendId: '2' }));
  openPopup();
  expect(await screen.findByRole('button', { name: 'Good' })).toBeEnabled();
  expect(screen.getByRole('link', { name: 'Add Two Numbers' })).toBeInTheDocument();
  const section = await screen.findByRole('region', { name: 'Current roadmap' });
  expect(await within(section).findByText('1 / 75 reviewed')).toBeInTheDocument();
  expect(await within(section).findByRole('link', { name: '3. Longest Substring' })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/longest-substring/description/'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
  await screen.findByText('All caught up');
  expect(within(section).getByRole('link', { name: '3. Longest Substring' })).toBeInTheDocument();

  await act(async () => background.addCard(buildProblem({ frontendId: '3' })));
  await within(section).findByText('No unadded, unskipped problems available on leetcode.com.');
  // Unreviewed cards are excluded from recommendations without counting as progress.
  expect(within(section).getByText('1 / 75 reviewed')).toBeInTheDocument();
  await act(async () => background.removeCard('1'));
  expect(await within(section).findByRole('link', { name: '1. Two Sum' })).toBeInTheDocument();
  expect(within(section).getByText('0 / 75 reviewed')).toBeInTheDocument();
});

it('updates empty-queue recommendations for skips, the preferred site, and the active roadmap', async () => {
  openPopup();
  await screen.findByText('Start your first review');
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
  expect(screen.getByText('Start your first review')).toBeInTheDocument();
});

it('shuffles the Home recommendation and opens random problems from Roadmaps', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  await background.setActiveRoadmap('blind-75');
  openPopup();
  const section = await screen.findByRole('region', { name: 'Current roadmap' });
  expect(await within(section).findByRole('link', { name: '1. Two Sum' })).toBeInTheDocument();

  fireEvent.click(within(section).getByRole('button', { name: 'Show a random problem from Blind 75' }));
  expect(await within(section).findByRole('link', { name: '3. Longest Substring' })).toBeInTheDocument();
  expect(within(section).getByText('Random pick')).toBeInTheDocument();
  // Only the shown problem remains, so another shuffle cannot change it.
  await act(async () => background.setRoadmapProblemSkipped('blind-75', '1', true));
  await waitFor(() =>
    expect(within(section).getByRole('button', { name: 'Show a random problem from Blind 75' })).toBeDisabled()
  );
  // A random pick that leaves the pool falls back to the next problem in order.
  await act(async () => background.setRoadmapProblemSkipped('blind-75', '1', false));
  await act(async () => background.setRoadmapProblemSkipped('blind-75', '3', true));
  expect(await within(section).findByRole('link', { name: '1. Two Sum' })).toBeInTheDocument();
  expect(within(section).queryByText('Random pick')).not.toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Roadmaps'));
  fireEvent.click(await screen.findByRole('button', { name: 'Open a random problem from Blind 75' }));
  expect(open).toHaveBeenLastCalledWith(
    'https://leetcode.com/problems/two-sum/description/',
    '_blank',
    'noopener,noreferrer'
  );
});

it('rates new and saved roadmap problems and retains feedback when a filter removes the row', async () => {
  await background.updateSettings({ preferredLeetcodeSite: 'leetcode.cn' });
  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  fireEvent.click(await screen.findByRole('button', { name: 'Open Blind 75' }));
  await selectFilter('All', 'Not in SRS');
  await chooseRowAction('两数之和', 'Save with rating…');
  let menu = await screen.findByRole('dialog', { name: 'Save 两数之和' });
  const good = within(menu).getByRole('button', { name: 'Good' });
  await waitFor(() => expect(good).toBeEnabled());
  fireEvent.click(good);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Add 两数之和 to SRS' })).not.toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent('两数之和 · Saved · Review in');
  expect((await readLearningDocument()).cards['1']).toMatchObject({ domain: 'leetcode.cn', fsrs: { reps: 1 } });

  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
  fireEvent.click(await screen.findByRole('button', { name: /Arrays & Hashing/ }));
  // Saved rows offer Rate again instead of adding.
  expect(screen.queryByRole('button', { name: 'Add 两数之和 to SRS' })).not.toBeInTheDocument();
  await chooseRowAction('两数之和', 'Rate again…');
  menu = await screen.findByRole('dialog', { name: 'Save 两数之和' });
  expect(within(menu).queryByRole('button', { name: 'Save without rating' })).not.toBeInTheDocument();
  const easy = within(menu).getByRole('button', { name: 'Easy' });
  await waitFor(() => expect(easy).toBeEnabled());
  fireEvent.click(easy);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect((await readLearningDocument()).cards['1'].fsrs.reps).toBe(2);
});

it('adds a roadmap problem without rating and undoes the add', async () => {
  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  fireEvent.click(await screen.findByRole('button', { name: 'Open Blind 75' }));
  fireEvent.click(await screen.findByRole('button', { name: /Arrays & Hashing/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Two Sum to SRS' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Two Sum · Added to SRS');
  expect((await readLearningDocument()).cards['1']).toMatchObject({ domain: 'leetcode.com', fsrs: { reps: 0 } });
  expect(screen.queryByRole('button', { name: 'Add Two Sum to SRS' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Undo adding Two Sum' }));
  expect(await screen.findByRole('button', { name: 'Add Two Sum to SRS' })).toBeInTheDocument();
  expect((await readLearningDocument()).cards['1']).toBeUndefined();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});
