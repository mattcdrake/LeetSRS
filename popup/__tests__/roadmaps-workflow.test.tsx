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

it('keeps detail open through activation changes and returns to overview on the next tab click', async () => {
  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  fireEvent.click(await screen.findByRole('button', { name: 'Open Blind 75' }));
  expect(await screen.findByRole('link', { name: 'NeetCode' })).toHaveAttribute(
    'href',
    'https://neetcode.io/practice/practice/blind75'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
  await screen.findByRole('button', { name: 'Activate' });
  expect(screen.getByRole('heading', { name: 'Blind 75' })).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Roadmaps'));
  expect(await screen.findByRole('switch', { name: 'Use Blind 75 as active roadmap' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Open NeetCode 150' }));
  fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
  await screen.findByRole('button', { name: 'Deactivate' });
  fireEvent.click(screen.getByRole('button', { name: 'Back to all roadmaps' }));
  expect(await screen.findByRole('switch', { name: 'Use NeetCode 150 as active roadmap' })).toBeChecked();
});

it('expands groups independently, combines single-select filters with search, and updates after card removal', async () => {
  await background.addCard(buildProblem({ frontendId: '1' }));
  await background.rateCard({ frontendId: '3', domain: 'leetcode.com', rating: Rating.Good });
  await background.setPauseStatus('3', true);
  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  fireEvent.click(await screen.findByRole('button', { name: 'Open Blind 75' }));
  const arrays = await screen.findByRole('button', { name: /Arrays & Hashing/ });
  const sliding = screen.getByRole('button', { name: /Sliding Window/ });
  expect(arrays).toHaveAttribute('aria-expanded', 'false');
  expect(sliding).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(arrays);
  fireEvent.click(sliding);
  expect(arrays).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('link', { name: '1. Two Sum' })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/two-sum/description/'
  );
  fireEvent.click(arrays);
  expect(sliding).toHaveAttribute('aria-expanded', 'true');

  fireEvent.click(screen.getByRole('button', { name: 'In SRS' }));
  expect(screen.getByRole('link', { name: '1. Two Sum' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '3. Longest Substring' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reviewed' }));
  expect(screen.getByRole('button', { name: 'In SRS' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByRole('link', { name: '1. Two Sum' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search roadmap problems' }), { target: { value: 'sum' } });
  expect(screen.getByText('No matching problems.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'In SRS' }));
  expect(screen.getByRole('link', { name: '1. Two Sum' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search roadmap problems' }), { target: { value: '1' } });
  expect(screen.getByText('1 problems · 1 groups')).toBeInTheDocument();
  await act(async () => background.removeCard('1'));
  await screen.findByText('No matching problems.');
  fireEvent.click(screen.getByRole('button', { name: 'Not in SRS' }));
  expect(screen.getByRole('link', { name: '1. Two Sum' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Not in SRS' }));
  expect(screen.getByRole('button', { name: 'Not in SRS' })).toHaveAttribute('aria-pressed', 'false');
});

it('persists skips within one roadmap across reopening and restores them without changing SRS progress', async () => {
  await background.rateCard({ ...buildProblem(), rating: Rating.Good });
  const popup = openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  fireEvent.click(await screen.findByRole('button', { name: 'Open Blind 75' }));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Search roadmap problems' }), {
    target: { value: 'Two Sum' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Skip Two Sum' }));
  await screen.findByRole('button', { name: 'Restore Two Sum' });
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
  fireEvent.click(screen.getByRole('button', { name: 'Back to all roadmaps' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open NeetCode 150' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search roadmap problems' }), { target: { value: 'Two Sum' } });
  expect(await screen.findByRole('button', { name: 'Skip Two Sum' })).toBeInTheDocument();
  popup.unmount();

  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  fireEvent.click(await screen.findByRole('button', { name: 'Open Blind 75' }));
  fireEvent.click(screen.getByRole('button', { name: 'Skipped' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore Two Sum' }));
  await screen.findByText('No matching problems.');
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
});

it('uses preferred-site titles and links while retaining unavailable problems for browsing and skipping', async () => {
  await background.updateSettings({ preferredLeetcodeSite: 'leetcode.cn' });
  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  fireEvent.click(await screen.findByRole('button', { name: 'Open Blind 75' }));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Search roadmap problems' }), {
    target: { value: 'Two Sum' },
  });
  expect(await screen.findByRole('link', { name: '1. 两数之和' })).toHaveAttribute(
    'href',
    'https://leetcode.cn/problems/two-sum/description/'
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Search roadmap problems' }), { target: { value: 'Longest' } });
  expect(screen.getByText('3. Longest Substring')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Longest/ })).not.toBeInTheDocument();
  expect(screen.getByText('Unavailable on leetcode.cn')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Skip Longest Substring' }));
  await screen.findByRole('button', { name: 'Restore Longest Substring' });
});

it('marks paid problems and lets a failed skip be retried', async () => {
  openPopup();
  fireEvent.click(await screen.findByLabelText('Roadmaps'));
  fireEvent.click(await screen.findByRole('button', { name: 'Open Blind 75' }));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Search roadmap problems' }), {
    target: { value: '271' },
  });
  expect(await screen.findByRole('img', { name: 'Paid-only problem' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '271. Encode and Decode Strings' })).toHaveAttribute(
    'href',
    'https://leetcode.com/problems/encode-and-decode-strings/description/'
  );
  vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('Storage unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Skip Encode and Decode Strings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save skipped problems. Try again.');
  fireEvent.click(screen.getByRole('button', { name: 'Skip Encode and Decode Strings' }));
  await screen.findByRole('button', { name: 'Restore Encode and Decode Strings' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
