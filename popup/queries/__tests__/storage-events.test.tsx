/** @vitest-environment happy-dom */
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { IDBDatabase } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { initializeCatalog } from '@/shared/catalog';
import type { GistSyncStatus } from '@/shared/models';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/shared/models';
import { readLearningDocument, replaceLearningDocument, STORAGE_KEYS } from '@/shared/storage';
import { requireDefined } from '@/test/utils/assertions';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildCatalogProblem, buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { seedGithubAuthorization } from '@/test/utils/github-auth';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper, createTestQueryClient } from '@/test/utils/test-wrapper';
import { useCardsQuery, useRateCardMutation, useReviewQueueQuery } from '../cards';
import { useGistSyncConfigQuery, useGistSyncStatusQuery } from '../gist-sync';
import { useNoteQuery } from '../notes';
import { useTodayReviewActivityQuery } from '../review-activity';
import { useSettingsQuery, useUpdateSettingsMutation } from '../settings';
import { useStorageQueryEvents } from '../storage-events';

const github = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return { rest: { gists: github } };
  }),
}));
vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));
vi.mock('@/shared/background-service');
const service = createServiceMock(background);
beforeEach(() => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  service.reset().resolve('waitForInitialization', undefined);
});
afterEach(() => {
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

async function startBackground() {
  const alarms = vi.spyOn(browser.alarms.onAlarm, 'addListener');
  backgroundEntry.main();
  service.use(getRegisteredBackground());
  await background.waitForInitialization();
  return requireDefined(alarms.mock.calls.at(-1)?.[0]);
}

it('reads a current connection without waiting for a learning document or background RPC', async () => {
  const connection = { accountId: 1, gistId: 'gist', enabled: true };
  await storage.setItem(STORAGE_KEYS.gistConnection, connection);
  const { result } = renderHook(() => useGistSyncConfigQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await waitFor(() => expect(result.current.data).toEqual(connection));
  expect(Object.values(background).flatMap((method) => vi.mocked(method).mock.calls)).toHaveLength(0);
});

it('returns a disabled connection without reviving retired credentials or requesting initialization', async () => {
  await fakeBrowser.storage.sync.set({
    'leetsrs:githubPat': 'legacy-secret',
    'leetsrs:gistId': 'legacy-gist',
    'leetsrs:gistSyncEnabled': true,
  });
  const { result } = renderHook(() => useGistSyncConfigQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await waitFor(() => expect(result.current.data).toEqual({ accountId: null, gistId: null, enabled: false }));
  expect(background.waitForInitialization).not.toHaveBeenCalled();
});

it.each(['success', 'failure'] as const)(
  'ignores an obsolete initial read %s after a storage notification',
  async (outcome) => {
    const pending = Promise.withResolvers<LearningDocument>();
    const reads = vi.spyOn(storage, 'getItem').mockReturnValue(pending.promise);
    const { result } = renderHook(() => useCardsQuery(), { wrapper: createPopupTestWrapper().wrapper });
    await waitFor(() => expect(reads).toHaveBeenCalled());
    reads.mockRestore();
    const card = createMockCard(State.New);
    await replaceLearningDocument(buildLearningDocument({ cards: { [card.frontendId]: card } }));
    await waitFor(() => expect(result.current.data).toEqual([{ ...card, ...buildCatalogProblem() }]));
    await act(async () => {
      if (outcome === 'success') pending.resolve(buildLearningDocument());
      else pending.reject(new Error('Obsolete failure'));
    });
    expect(result.current.data).toEqual([{ ...card, ...buildCatalogProblem() }]);
    expect(result.current.error).toBeNull();
  }
);

it('keeps an open view unchanged for unrelated events or a disposed subscription, then refreshes on remount', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  const first = createMockCard(State.New);
  await replaceLearningDocument(buildLearningDocument({ cards: { [first.frontendId]: first } }));
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({ queries: { staleTime: Infinity, retry: false } });
  let observing = true;
  function Observer() {
    useStorageQueryEvents();
    return null;
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {observing && <Observer />}
      {children}
    </QueryClientProvider>
  );
  const view = renderHook(() => useCardsQuery(), { wrapper });
  await act(() => vi.advanceTimersByTimeAsync(1));
  await vi.waitFor(() => expect(view.result.current.data).toEqual([{ ...first, ...buildCatalogProblem() }]));
  expect(background.waitForInitialization).toHaveBeenCalledWith();

  const reads = vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('Storage unavailable'));
  await act(async () => {
    await storage.setItem('local:unrelated', 'change');
    await vi.advanceTimersByTimeAsync(1);
  });
  await vi.waitFor(() => expect(view.result.current.data).toEqual([{ ...first, ...buildCatalogProblem() }]));
  expect(view.result.current.error).toBeNull();
  reads.mockRestore();

  observing = false;
  view.rerender();
  await act(async () => {
    await replaceLearningDocument(buildLearningDocument());
    await vi.advanceTimersByTimeAsync(1);
  });
  await vi.waitFor(() => expect(view.result.current.data).toEqual([{ ...first, ...buildCatalogProblem() }]));
  observing = true;
  view.rerender();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(view.result.current.data).toEqual([]);
  view.unmount();
  queryClient.clear();
});

it.each([null, { schemaVersion: 5, cards: {}, stats: {}, settings: {} }])(
  'waits for background initialization of %j without writing from the reader',
  async (stored) => {
    await storage.setItem(STORAGE_KEYS.learningDocument, stored);
    const ready = Promise.withResolvers<void>();
    service.resolve('waitForInitialization', ready.promise);
    const documentRead = readLearningDocument();
    const completed = vi.fn();
    void documentRead.then(completed, completed);
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const { result } = renderHook(() => useCardsQuery(), { wrapper: createPopupTestWrapper().wrapper });
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(completed).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(await storage.getItem(STORAGE_KEYS.learningDocument)).toEqual(stored);
    await act(async () => {
      await replaceLearningDocument(buildLearningDocument());
      ready.resolve();
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.data).toEqual([]);
    expect(await documentRead).toEqual(buildLearningDocument());
  }
);

it.each([useCardsQuery])('reports initialization failure without presenting default data (%s)', async (useQuery) => {
  service.handle('waitForInitialization', () => {
    throw new Error('Conversion failed');
  });
  const { result } = renderHook(() => useQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await waitFor(() => expect(result.current.error?.message).toBe('Conversion failed'));
  expect(result.current.data).toBeUndefined();
  expect(await storage.getItem(STORAGE_KEYS.learningDocument)).toBeNull();
});

it.each([
  { schemaVersion: LEARNING_DOCUMENT_VERSION + 1, cards: {}, stats: {}, settings: {} },
  { schemaVersion: LEARNING_DOCUMENT_VERSION, cards: 'corrupt', stats: {}, settings: {} },
])('reports invalid current data directly: %j', async (document) => {
  await storage.setItem(STORAGE_KEYS.learningDocument, document);
  service.resolve('waitForInitialization', new Promise<void>(() => {}));
  const { result } = renderHook(() => useCardsQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect(Object.values(background).flatMap((method) => vi.mocked(method).mock.calls)).toHaveLength(0);
});

it('runs local queries and saves while offline', async () => {
  await startBackground();
  onlineManager.setOnline(false);
  const { result } = renderHook(
    () => ({
      cards: useCardsQuery(),
      settings: useSettingsQuery(),
      config: useGistSyncConfigQuery(),
      rate: useRateCardMutation(),
      update: useUpdateSettingsMutation(),
    }),
    { wrapper: createPopupTestWrapper().wrapper }
  );
  await waitFor(() => expect(result.current?.config.isSuccess).toBe(true));
  expect(result.current.cards.data).toEqual([]);
  await act(async () => {
    await result.current.rate.mutateAsync({ ...buildProblem(), rating: Rating.Good });
    await result.current.update.mutateAsync({ theme: 'dark' });
  });
  await waitFor(() => expect(result.current.settings.data.theme).toBe('dark'));
  expect(result.current.cards.data).toMatchObject([buildProblem()]);
});

it('refreshes saved views after a content command and an alarm pull, including connection and status changes', async () => {
  const alarm = await startBackground();
  const problem = buildProblem();
  await background.addCard(problem);
  const { result } = renderHook(
    () => ({
      cards: useCardsQuery(),
      note: useNoteQuery(problem.frontendId),
      settings: useSettingsQuery(),
      config: useGistSyncConfigQuery(),
      status: useGistSyncStatusQuery(),
    }),
    { wrapper: createPopupTestWrapper().wrapper }
  );
  await waitFor(() => expect(result.current?.note.isSuccess).toBe(true));
  // Content sends this same command without a popup mutation hook.
  await act(() => background.saveNote(problem.frontendId, 'Content edit'));
  await waitFor(() => expect(result.current.note.data).toBe('Content edit'));
  await seedGithubAuthorization();
  await storage.setItem(STORAGE_KEYS.gistConnection, { accountId: 1, gistId: 'gist', enabled: true });
  await waitFor(() => expect(result.current.config.data?.enabled).toBe(true));
  const remote = buildLearningDocument({
    settings: { maxNewCardsPerDay: 9 },
    dataUpdatedAt: '2099-01-01T00:00:00.000Z',
  });
  github.get.mockResolvedValue({ data: { files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } } });
  await act(() =>
    alarm({ name: 'gist-sync', scheduledTime: Date.now(), periodInMinutes: 1, persistAcrossSessions: true })
  );
  await waitFor(() => {
    expect(result.current.cards.data).toEqual([]);
    expect(result.current.note.data).toBeNull();
    expect(result.current.settings.data.maxNewCardsPerDay).toBe(9);
    expect(result.current.status.data?.lastSyncTime).toEqual(expect.any(String));
  });
});

it.each(['tick', 'visibility'] as const)(
  'advances the review day and queue allowance on %s without storage or catalog access',
  async (trigger) => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2024-03-15T23:59:55'));
    const card = createMockCard(State.New);
    const stats = { date: '2024-03-15', newCards: 1, streak: 1 };
    await replaceLearningDocument(
      buildLearningDocument({
        cards: { [card.frontendId]: card },
        reviewActivity: stats,
        settings: { maxNewCardsPerDay: 1 },
      })
    );
    const view = renderHook(
      () => ({
        queue: useReviewQueueQuery(),
        today: useTodayReviewActivityQuery(),
      }),
      { wrapper: createPopupTestWrapper().wrapper }
    );
    await act(() => vi.advanceTimersByTimeAsync(1));
    await vi.waitFor(() => expect(view.result.current.queue.data).toEqual([]));
    expect(view.result.current.today.data).toEqual(stats);
    const writes = vi.spyOn(storage, 'setItem');
    const reads = vi.spyOn(storage, 'getItem');
    const transactions = vi.spyOn(IDBDatabase.prototype, 'transaction');
    await act(async () => {
      if (trigger === 'tick') {
        await vi.advanceTimersByTimeAsync(15_000);
      } else {
        vi.setSystemTime(new Date('2024-03-16T00:00:10'));
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(1);
      }
    });
    await vi.waitFor(() => expect(view.result.current.queue.data).toEqual([{ ...card, ...buildCatalogProblem() }]));
    expect(view.result.current.today.data).toBeNull();
    expect(writes).not.toHaveBeenCalled();
    expect(reads).not.toHaveBeenCalled();
    expect(transactions).not.toHaveBeenCalled();
    view.unmount();
  }
);

it('keeps a successful local save successful when refreshing the cache fails', async () => {
  await startBackground();
  const { result } = renderHook(() => ({ cards: useCardsQuery(), rate: useRateCardMutation() }), {
    wrapper: createPopupTestWrapper().wrapper,
  });
  await waitFor(() => expect(result.current.cards.isSuccess).toBe(true));
  const reads = vi.spyOn(storage, 'getItem');
  const write = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
  vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation((items) => {
    reads.mockRejectedValue(new Error('Read failed'));
    return write(items);
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  await act(() => result.current.rate.mutateAsync({ ...buildProblem(), rating: Rating.Good }));
  await waitFor(() => expect(result.current.cards.error?.message).toBe('Read failed'));
  expect(result.current.rate.isSuccess).toBe(true);
  reads.mockRestore();
  await act(() => result.current.cards.refetch());
  await waitFor(() => expect(result.current.cards.data).toMatchObject([buildProblem()]));
});

it('keeps polling background-only sync progress and errors without stored changes', async () => {
  await replaceLearningDocument(buildLearningDocument());
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  let status: GistSyncStatus = {
    lastSyncTime: null,
    syncInProgress: true,
    lastError: null,
  };
  service.handle('getGistSyncStatus', () => status);
  const view = renderHook(() => useGistSyncStatusQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(view.result.current.data?.syncInProgress).toBe(true);
  status = { ...status, syncInProgress: false, lastError: 'unavailable' };
  await act(() => vi.advanceTimersByTimeAsync(15_000));
  expect(view.result.current.data).toEqual(status);
  view.unmount();
});

beforeEach(initializeCatalog);
