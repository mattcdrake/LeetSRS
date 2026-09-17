/** @vitest-environment happy-dom */
import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { ROADMAP_IDS } from '@/shared/roadmap';
import { readLearningDocument, STORAGE_KEYS } from '@/shared/storage';
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
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const id = ROADMAP_IDS.find((id) => input === fakeBrowser.runtime.getURL(`/data/roadmaps/${id}.json`));
    return id
      ? Promise.resolve(Response.json(JSON.parse(readFileSync(`public/data/roadmaps/${id}.json`, 'utf8'))))
      : fetchCatalog(input, init);
  });
  backgroundEntry.main();
  createServiceMock(background).reset().use(getRegisteredBackground());
  await background.waitForInitialization();
});

const openPopup = () => render(<PopupRoot queryClient={createPopupQueryClient()} />);
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const toggle = (name: string) => screen.getByRole('switch', { name: `Use ${name} as active roadmap` });
const order = () => screen.getAllByRole('region').map((row) => row.getAttribute('aria-label'));

it('keeps activation local, reorders switches exclusively, and restores tab navigation on reopen', async () => {
  const learningBefore = await readLearningDocument();
  const popup = openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  await screen.findByRole('button', { name: 'Open Blind 75' });
  expect(order()).toEqual(['Blind 75', 'NeetCode 150', 'NeetCode 250', 'Grind 75']);
  expect(screen.getAllByRole('switch').every((control) => control.getAttribute('aria-checked') === 'false')).toBe(true);

  // Browsing does not activate a roadmap.
  click('Open NeetCode 150');
  expect(screen.getByRole('heading', { name: 'NeetCode 150' })).toBeInTheDocument();
  expect(screen.getByText('0 of 150 reviewed')).toBeInTheDocument();
  expect(await storage.getItem(STORAGE_KEYS.activeRoadmapId)).toBeNull();
  click('Back to all roadmaps');

  fireEvent.click(toggle('Grind 75'));
  await waitFor(() => expect(toggle('Grind 75')).toBeChecked());
  expect(order()).toEqual(['Grind 75', 'Blind 75', 'NeetCode 150', 'NeetCode 250']);
  fireEvent.click(toggle('NeetCode 250'));
  await waitFor(() => expect(toggle('NeetCode 250')).toBeChecked());
  expect(toggle('Grind 75')).not.toBeChecked();
  expect(order()).toEqual(['NeetCode 250', 'Blind 75', 'NeetCode 150', 'Grind 75']);
  expect(await readLearningDocument()).toEqual(learningBefore);
  expect(await storage.getItem(STORAGE_KEYS.activeRoadmapId)).toBe('neetcode-250');

  // Clicking the already selected tab also returns to the active roadmap.
  fireEvent.click(screen.getByRole('radio', { name: 'Roadmaps' }));
  expect(screen.getByRole('heading', { name: 'NeetCode 250' })).toBeInTheDocument();
  click('Back to all roadmaps');
  click('Open Blind 75');
  fireEvent.click(screen.getByRole('radio', { name: 'Cards' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Roadmaps' }));
  expect(screen.getByRole('heading', { name: 'NeetCode 250' })).toBeInTheDocument();
  popup.unmount();

  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  await screen.findByRole('heading', { name: 'NeetCode 250' });
  click('Back to all roadmaps');
  fireEvent.click(toggle('NeetCode 250'));
  await waitFor(() => expect(toggle('NeetCode 250')).not.toBeChecked());
  expect(order()).toEqual(['Blind 75', 'NeetCode 150', 'NeetCode 250', 'Grind 75']);
  click('Open Blind 75');
  fireEvent.click(screen.getByRole('radio', { name: 'Roadmaps' }));
  expect(screen.getByRole('heading', { name: 'Roadmaps' })).toBeInTheDocument();
  expect(await storage.getItem(STORAGE_KEYS.activeRoadmapId)).toBeNull();
});

it('counts only current reviewed cards across domains and roadmaps, including paused cards', async () => {
  await background.addCard(buildProblem({ domain: 'leetcode.cn' }));
  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  const blind = await screen.findByRole('region', { name: 'Blind 75' });
  expect(within(blind).getByText('0 / 75')).toBeInTheDocument();
  await act(async () => {
    await background.rateCard({ ...buildProblem({ domain: 'leetcode.cn' }), rating: Rating.Good });
    await background.setPauseStatus('1', true);
  });
  await within(blind).findByText('1 / 75');
  expect(within(screen.getByRole('region', { name: 'Grind 75' })).getByText('1 / 75')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'NeetCode 150' })).getByText('1 / 150')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'NeetCode 250' })).getByText('1 / 250')).toBeInTheDocument();
  await act(async () => background.removeCard('1'));
  await within(blind).findByText('0 / 75');
});

it('keeps the saved selection after a failed write and allows retry', async () => {
  await storage.setItem(STORAGE_KEYS.activeRoadmapId, 'blind-75');
  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  await screen.findByRole('heading', { name: 'Blind 75' });
  click('Back to all roadmaps');
  vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Disk unavailable'));
  fireEvent.click(toggle('Grind 75'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the active roadmap');
  expect(toggle('Blind 75')).toBeChecked();
  expect(toggle('Grind 75')).not.toBeChecked();
  expect(await storage.getItem(STORAGE_KEYS.activeRoadmapId)).toBe('blind-75');
  fireEvent.click(toggle('Grind 75'));
  await waitFor(() => expect(toggle('Grind 75')).toBeChecked());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it.each([false, true])('reorders with reduced motion set to %s', async (reducedMotion) => {
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    const media = matchMedia(query);
    if (query === '(prefers-reduced-motion: reduce)') {
      Object.defineProperty(media, 'matches', { value: reducedMotion });
    }
    return media;
  });
  // Happy DOM has no layout; give the rows their displayed positions.
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
    return this.parentElement ? [...this.parentElement.children].indexOf(this) * 66 : 0;
  });
  const animate = vi.spyOn(HTMLElement.prototype, 'animate');
  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  await screen.findByRole('button', { name: 'Open Blind 75' });
  expect(animate).not.toHaveBeenCalled();
  fireEvent.click(toggle('Grind 75'));
  await waitFor(() => expect(toggle('Grind 75')).toBeChecked());
  expect(order()).toEqual(['Grind 75', 'Blind 75', 'NeetCode 150', 'NeetCode 250']);
  expect(animate).toHaveBeenCalledTimes(reducedMotion ? 0 : 4);
});
