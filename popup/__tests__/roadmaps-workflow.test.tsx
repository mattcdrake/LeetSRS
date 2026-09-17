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
});

const openPopup = () => render(<PopupRoot queryClient={createPopupQueryClient()} />);
it('browses, activates, filters, and restores a saved roadmap', async () => {
  await background.rateCard({ ...buildProblem({ domain: 'leetcode.cn' }), rating: Rating.Good });
  const popup = openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  const overview = await screen.findByRole('region', { name: 'Blind 75' });
  expect(within(overview).getByText('1 / 75')).toBeInTheDocument();
  fireEvent.click(within(overview).getByRole('button', { name: 'Open Blind 75' }));

  const arrays = await screen.findByRole('button', { name: /Arrays & Hashing/ });
  expect(arrays).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(arrays);
  expect(screen.getByRole('link', { name: '1. Two Sum' })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/two-sum/description/'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
  await screen.findByRole('button', { name: 'Deactivate' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Search roadmap problems' }), { target: { value: 'Two Sum' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reviewed' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Skip Two Sum' }));
  await screen.findByRole('button', { name: 'Restore Two Sum' });
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
  popup.unmount();

  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  expect(await screen.findByRole('heading', { name: 'Blind 75' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Skipped' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore Two Sum' }));
  await screen.findByText('No matching problems.');
  await act(async () => background.removeCard('1'));
  await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0'));
  fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
  await screen.findByRole('button', { name: 'Activate' });
  expect(screen.getByRole('heading', { name: 'Blind 75' })).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Roadmaps'));
  expect(await screen.findByRole('switch', { name: 'Use Blind 75 as active roadmap' })).not.toBeChecked();
});
