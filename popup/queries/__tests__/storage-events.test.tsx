/** @vitest-environment happy-dom */
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { initializeLearningDocument } from '@/background/legacy/learning-document-startup';
import { createDailyStats } from '@/background/statistics';
import background from '@/entrypoints/background/index';
import { I18nProvider } from '@/popup/contexts/I18nContext';
import { onMessage, sendMessage } from '@/shared/messages';
import type { GistSyncStatus } from '@/shared/models';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument } from '@/shared/models';
import { readLearningDocument, replaceLearningDocument, STORAGE_KEYS } from '@/shared/storage';
import { requireDefined } from '@/test/utils/assertions';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper, createTestQueryClient } from '@/test/utils/test-wrapper';
import { useCardsQuery, useRateCardMutation, useReviewQueueQuery } from '../cards';
import { useExportDataMutation } from '../data';
import { useGistSyncConfigQuery, useGistSyncStatusQuery, useSetGistSyncEnabledMutation } from '../gist-sync';
import { useNoteQuery } from '../notes';
import { useSettingsQuery, useUpdateSettingsMutation } from '../settings';
import { useLastNDaysStatsQuery, useNextNDaysStatsQuery, useTodayStatsQuery } from '../stats';
import { useStorageQueryEvents } from '../storage-events';

const github = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('octokit', () => ({
  Octokit: vi.fn(function MockOctokit() {
    return { rest: { gists: github } };
  }),
}));
vi.mock('@/shared/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/messages')>()),
  onMessage: vi.fn(),
  sendMessage: vi.fn(),
}));
const messages = createMessageMock(vi.mocked(sendMessage));
beforeEach(() => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  messages.reset();
});
afterEach(() => {
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

async function startBackground() {
  const alarms = vi.spyOn(browser.alarms.onAlarm, 'addListener');
  background.main();
  for (const [name, listener] of vi.mocked(onMessage).mock.calls) {
    messages.handle(name, (data) => listener({ id: 1, type: name, data, timestamp: 0, sender: {} }));
  }
  await sendMessage('waitForInitialization');
  return requireDefined(alarms.mock.calls.at(-1)?.[0]);
}

it('reads a current connection without waiting for a learning document or background RPC', async () => {
  const connection = { pat: 'secret', gistId: 'gist', enabled: true };
  await storage.setItem(STORAGE_KEYS.gistConnection, connection);
  const { result } = renderHook(() => useGistSyncConfigQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await waitFor(() => expect(result.current.data).toEqual(connection));
  expect(sendMessage).not.toHaveBeenCalled();
});

it.each([false, true])('initializes a missing connection before reading it (legacy: %s)', async (legacy) => {
  if (legacy) {
    await fakeBrowser.storage.sync.set({
      'leetsrs:githubPat': 'legacy-secret',
      'leetsrs:gistId': 'legacy-gist',
      'leetsrs:gistSyncEnabled': true,
    });
  }
  messages.handle('waitForInitialization', initializeLearningDocument);
  const { result } = renderHook(() => useGistSyncConfigQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await waitFor(() =>
    expect(result.current.data).toEqual(
      legacy
        ? { pat: 'legacy-secret', gistId: 'legacy-gist', enabled: true }
        : { pat: '', gistId: null, enabled: false }
    )
  );
  expect(sendMessage).toHaveBeenCalledExactlyOnceWith('waitForInitialization');
});

it('returns the disabled connection after readiness when a current installation has none', async () => {
  await replaceLearningDocument(buildLearningDocument());
  messages.handle('waitForInitialization', initializeLearningDocument);
  const { result } = renderHook(() => useGistSyncConfigQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await waitFor(() => expect(result.current.data).toEqual({ pat: '', gistId: null, enabled: false }));
  expect(sendMessage).toHaveBeenCalledExactlyOnceWith('waitForInitialization');
});

it('reports invalid connection data without requesting initialization', async () => {
  await storage.setItem(STORAGE_KEYS.gistConnection, { pat: 42 });
  const { result } = renderHook(() => useGistSyncConfigQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect(sendMessage).not.toHaveBeenCalled();
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
    await replaceLearningDocument(buildLearningDocument({ cards: { [card.slug]: card } }));
    await waitFor(() => expect(result.current.data).toEqual([card]));
    await act(async () => {
      if (outcome === 'success') pending.resolve(buildLearningDocument());
      else pending.reject(new Error('Obsolete failure'));
    });
    expect(result.current.data).toEqual([card]);
    expect(result.current.error).toBeNull();
  }
);

it('keeps an open view unchanged for unrelated events or a disposed subscription, then refreshes on remount', async () => {
  vi.useFakeTimers();
  const first = createMockCard(State.New);
  await replaceLearningDocument(buildLearningDocument({ cards: { [first.slug]: first } }));
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
  expect(view.result.current.data).toEqual([first]);
  expect(sendMessage).not.toHaveBeenCalled();

  const reads = vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('Storage unavailable'));
  await act(async () => {
    await storage.setItem('local:unrelated', 'change');
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(view.result.current.data).toEqual([first]);
  expect(view.result.current.error).toBeNull();
  reads.mockRestore();

  observing = false;
  view.rerender();
  await act(async () => {
    await replaceLearningDocument(buildLearningDocument());
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(view.result.current.data).toEqual([first]);
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
    messages.resolve('waitForInitialization', ready.promise);
    const documentRead = readLearningDocument();
    const completed = vi.fn();
    void documentRead.then(completed, completed);
    vi.useFakeTimers();
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

it.each([useCardsQuery, useGistSyncConfigQuery])(
  'reports initialization failure without presenting default data (%s)',
  async (useQuery) => {
    messages.handle('waitForInitialization', () => {
      throw new Error('Conversion failed');
    });
    const { result } = renderHook(() => useQuery(), { wrapper: createPopupTestWrapper().wrapper });
    await waitFor(() => expect(result.current.error?.message).toBe('Conversion failed'));
    expect(result.current.data).toBeUndefined();
    expect(await storage.getItem(STORAGE_KEYS.learningDocument)).toBeNull();
  }
);

it.each([
  { schemaVersion: -1, cards: {}, stats: {}, settings: {} },
  { schemaVersion: LEARNING_DOCUMENT_VERSION + 1, cards: {}, stats: {}, settings: {} },
  { schemaVersion: LEARNING_DOCUMENT_VERSION, cards: 'corrupt', stats: {}, settings: {} },
])('reports invalid current data directly: %j', async (document) => {
  await storage.setItem(STORAGE_KEYS.learningDocument, document);
  messages.resolve('waitForInitialization', new Promise<void>(() => {}));
  const { result } = renderHook(() => useCardsQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect(sendMessage).not.toHaveBeenCalled();
});

it('runs local queries, saves, and validated export while offline', async () => {
  await startBackground();
  onlineManager.setOnline(false);
  const { result } = renderHook(
    () => ({
      cards: useCardsQuery(),
      settings: useSettingsQuery(),
      config: useGistSyncConfigQuery(),
      rate: useRateCardMutation(),
      update: useUpdateSettingsMutation(),
      export: useExportDataMutation(),
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
  await act(async () => {
    const exported = JSON.parse(await result.current.export.mutateAsync());
    expect(exported).toEqual(await readLearningDocument());
    expect(exported).not.toHaveProperty('pat');
  });
});

it('refreshes saved views after a content command and an alarm pull, including connection and status changes', async () => {
  const alarm = await startBackground();
  const problem = buildProblem();
  await sendMessage('addCard', { problem });
  const { result } = renderHook(
    () => ({
      cards: useCardsQuery(),
      note: useNoteQuery(problem.slug),
      settings: useSettingsQuery(),
      config: useGistSyncConfigQuery(),
      status: useGistSyncStatusQuery(),
    }),
    { wrapper: createPopupTestWrapper().wrapper }
  );
  await waitFor(() => expect(result.current?.note.isSuccess).toBe(true));
  // Content sends this same command without a popup mutation hook.
  await act(() => sendMessage('saveNote', { slug: problem.slug, text: 'Content edit' }));
  await waitFor(() => expect(result.current.note.data).toBe('Content edit'));
  await storage.setItem(STORAGE_KEYS.gistConnection, { pat: 'secret', gistId: 'gist', enabled: true });
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
    expect(result.current.status.data?.lastSyncDirection).toBe('pull');
  });
});

it('advances the review day and queue allowance without a storage write', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-03-15T23:59:55'));
  const card = createMockCard(State.New);
  const stats = { ...createDailyStats(undefined), newCards: 1, gradeBreakdown: { 1: 0, 2: 0, 3: 1, 4: 0 } };
  await replaceLearningDocument(
    buildLearningDocument({
      cards: { [card.slug]: card },
      stats: { '2024-03-15': stats },
      settings: { maxNewCardsPerDay: 1 },
    })
  );
  const view = renderHook(
    () => ({
      queue: useReviewQueueQuery(),
      today: useTodayStatsQuery(),
      history: useLastNDaysStatsQuery(1),
      upcoming: useNextNDaysStatsQuery(1),
    }),
    { wrapper: createPopupTestWrapper().wrapper }
  );
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(view.result.current.queue.data).toEqual([]);
  expect(view.result.current.today.data).toEqual(stats);
  const writes = vi.spyOn(storage, 'setItem');
  await act(() => vi.advanceTimersByTimeAsync(15_000));
  expect(view.result.current.queue.data).toEqual([card]);
  expect(view.result.current.today.data).toBeNull();
  expect(view.result.current.history.data).toMatchObject([
    { date: '2024-03-16', gradeBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0 } },
  ]);
  expect(view.result.current.upcoming.data).toEqual([{ date: '2024-03-16', count: 1 }]);
  expect(writes).not.toHaveBeenCalled();
  view.unmount();
});

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
  vi.useFakeTimers();
  const status: GistSyncStatus = {
    lastSyncTime: null,
    lastSyncDirection: null,
    syncInProgress: true,
    lastError: null,
  };
  messages.handle('getGistSyncStatus', () => status);
  const view = renderHook(() => useGistSyncStatusQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(view.result.current.data?.syncInProgress).toBe(true);
  status.syncInProgress = false;
  status.lastError = 'unavailable';
  await act(() => vi.advanceTimersByTimeAsync(15_000));
  expect(view.result.current.data).toEqual(status);
  view.unmount();
});

it('loads settings inside Suspense alongside the root storage observer', async () => {
  await replaceLearningDocument(buildLearningDocument());
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({ queries: { staleTime: 300_000, retry: false } });
  function Observer() {
    useStorageQueryEvents();
    return null;
  }
  render(
    <QueryClientProvider client={queryClient}>
      <Observer />
      <Suspense fallback={<span>Loading settings</span>}>
        <I18nProvider>
          <span>Ready</span>
        </I18nProvider>
      </Suspense>
    </QueryClientProvider>
  );
  await screen.findByText('Ready');
  queryClient.clear();
});

it('disables automatic sync offline without attempting GitHub', async () => {
  await startBackground();
  await storage.setItem(STORAGE_KEYS.gistConnection, { pat: 'secret', gistId: 'gist', enabled: true });
  await waitFor(() => expect(github.get).toHaveBeenCalledOnce());
  github.get.mockClear();
  onlineManager.setOnline(false);
  const { result } = renderHook(() => ({ config: useGistSyncConfigQuery(), toggle: useSetGistSyncEnabledMutation() }), {
    wrapper: createPopupTestWrapper().wrapper,
  });
  await waitFor(() => expect(result.current.config.data?.enabled).toBe(true));
  act(() => result.current.toggle.mutate(false));
  await waitFor(() => expect(result.current.config.data?.enabled).toBe(false));
  expect(result.current.toggle.isSuccess).toBe(true);
  expect(github.get).not.toHaveBeenCalled();
});
