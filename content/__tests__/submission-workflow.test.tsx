/** @vitest-environment happy-dom */
import { act, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import backgroundEntry from '@/entrypoints/background/index';
import submissionsEntry from '@/entrypoints/submissions.content';
import { background } from '@/shared/background-service';
import { readLearningDocument } from '@/shared/storage';
import { requireDefined } from '@/test/utils/assertions';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { createServiceMock } from '@/test/utils/service-mocks';
import { bootstrapContent } from '../bootstrap';
import { ACCEPTED_SUBMISSION_MESSAGE, observeSubmissions } from '../submission-observer';

vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));
vi.mock('@/shared/background-service');
vi.mock('../submission-observer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../submission-observer')>();
  return { ...actual, observeSubmissions: vi.fn(actual.observeSubmissions) };
});

let ctx: ContentScriptContext;
const network = vi.fn<typeof fetch>();
let restorePage: () => void;
beforeEach(async () => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  backgroundEntry.main();
  createServiceMock(background).reset().use(getRegisteredBackground());
  await background.waitForInitialization();
  window.history.replaceState({}, '', '/problems/two-sum/');
  document.body.innerHTML = '<div id="ide-top-btns"><div id="last-group"></div></div>';
  ctx = new ContentScriptContext('test');
  await act(() => bootstrapContent(ctx));
  vi.stubGlobal('fetch', network);
  // Happy DOM omits the sender on postMessage; supply the browser's same-window envelope.
  vi.spyOn(window, 'postMessage').mockImplementation((data, origin) => {
    expect(origin).toBe(window.location.origin);
    window.dispatchEvent(new MessageEvent('message', { data, origin: window.location.origin, source: window }));
  });
  submissionsEntry.main(ctx);
  restorePage = requireDefined(vi.mocked(observeSubmissions).mock.results[0]).value;
});
afterEach(() => {
  act(() => ctx.notifyInvalidated());
  restorePage();
  document.body.innerHTML = '';
});

async function request(path: string, body: unknown, method = 'GET') {
  network.mockResolvedValueOnce(Response.json(body));
  await act(async () => {
    await window.fetch(path, { method });
    // The observer reads a cloned response without delaying the page's request.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
async function submit(id: number) {
  await request('/problems/two-sum/submit/', { submission_id: id }, 'POST');
  await request(`/submissions/detail/${id}/check/`, { state: 'SUCCESS', status_code: 10 });
}
function controls() {
  const shadow = requireDefined(document.querySelector('leetsrs-control')?.shadowRoot);
  return within(shadow as unknown as HTMLElement);
}

it('opens one panel for an accepted submission, saves a review, and ignores duplicate notifications', async () => {
  const ui = controls();
  await submit(1);
  const good = await ui.findByRole('button', { name: 'Good' });
  await waitFor(() => expect(good).toBeEnabled());
  expect(ui.getAllByRole('dialog')).toHaveLength(1);
  fireEvent.click(good);
  expect(await ui.findByRole('status')).toHaveTextContent('Saved · Review in 3 days');
  expect(ui.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  expect((await readLearningDocument()).cards['1'].fsrs.reps).toBe(1);
  expect((await readLearningDocument()).reviewActivity?.newCards).toBe(1);
  fireEvent.keyDown(ui.getByRole('dialog'), { key: 'Escape' });
  await request('/submissions/detail/1/check/', { state: 'SUCCESS', status_code: 10 });
  await act(async () =>
    window.postMessage(
      { type: ACCEPTED_SUBMISSION_MESSAGE, slug: 'two-sum', submissionId: '1' },
      window.location.origin
    )
  );
  expect(ui.queryByRole('dialog')).not.toBeInTheDocument();
  expect((await readLearningDocument()).cards['1'].fsrs.reps).toBe(1);
  await submit(2);
  expect(await ui.findByRole('dialog')).toBeInTheDocument();
});

it('persists opt-out after solving while keeping manual rating available', async () => {
  const ui = controls();
  await submit(1);
  fireEvent.click(await ui.findByRole('button', { name: 'Turn off auto-open' }));
  await waitFor(async () => expect((await readLearningDocument()).settings.openRatingAfterSolving).toBe(false));
  fireEvent.keyDown(ui.getByRole('dialog'), { key: 'Escape' });
  await submit(2);
  expect(ui.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(ui.getByRole('button', { name: 'LeetSRS' }));
  const good = await ui.findByRole('button', { name: 'Good' });
  await waitFor(() => expect(good).toBeEnabled());
  fireEvent.click(good);
  await ui.findByRole('status');
  expect((await readLearningDocument()).cards['1'].fsrs.reps).toBe(1);
});
