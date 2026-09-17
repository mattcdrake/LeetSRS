/** @vitest-environment happy-dom */
import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Rating } from 'ts-fsrs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
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
it('opens the saved active roadmap from the tab after reopening the popup', async () => {
  const popup = openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  const activation = await screen.findByRole('switch', { name: 'Use NeetCode 250 as active roadmap' });
  fireEvent.click(activation);
  await waitFor(() => expect(activation).toBeChecked());
  popup.unmount();

  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  expect(await screen.findByRole('heading', { name: 'NeetCode 250' })).toBeInTheDocument();
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
