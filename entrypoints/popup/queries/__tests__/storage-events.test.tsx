/** @vitest-environment happy-dom */
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import type { LearningDocument } from '@/domain/learning-document';
import { createDailyStats } from '@/domain/statistics';
import background from '@/entrypoints/background';
import { I18nProvider } from '@/entrypoints/popup/contexts/I18nContext';
import { onMessage, sendMessage } from '@/infrastructure/browser/messages';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { requireDefined } from '@/test/utils/assertions';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createTestQueryClient, createTestWrapper } from '@/test/utils/test-wrapper';
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
vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
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

it.each(['success', 'failure'] as const)(
  'ignores an obsolete initial read %s after a storage notification',
  async (outcome) => {
    const pending = Promise.withResolvers<LearningDocument>();
    const reads = vi.spyOn(storage, 'getItem').mockReturnValue(pending.promise);
    const { result } = renderHook(() => useCardsQuery(), { wrapper: createTestWrapper().wrapper });
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
    vi.useFakeTimers();
    const { result } = renderHook(() => useCardsQuery(), { wrapper: createTestWrapper().wrapper });
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(await storage.getItem(STORAGE_KEYS.learningDocument)).toEqual(stored);
    await act(async () => {
      await replaceLearningDocument(buildLearningDocument());
      ready.resolve();
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.data).toEqual([]);
  }
);

it('reports initialization failure without presenting an empty account', async () => {
  messages.handle('waitForInitialization', () => {
    throw new Error('Conversion failed');
  });
  const { result } = renderHook(() => useCardsQuery(), { wrapper: createTestWrapper().wrapper });
  await waitFor(() => expect(result.current.error?.message).toBe('Conversion failed'));
  expect(result.current.data).toBeUndefined();
  expect(await storage.getItem(STORAGE_KEYS.learningDocument)).toBeNull();
});

it.each([
  { schemaVersion: 7, cards: {}, stats: {}, settings: {} },
  { schemaVersion: 6, cards: 'corrupt', stats: {}, settings: {} },
])('reports invalid current data directly: %j', async (document) => {
  await storage.setItem(STORAGE_KEYS.learningDocument, document);
  const { result } = renderHook(() => useCardsQuery(), { wrapper: createTestWrapper().wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
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
    { wrapper: createTestWrapper().wrapper }
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
    { wrapper: createTestWrapper().wrapper }
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
  const stats = { ...createDailyStats('2024-03-15', undefined), newCards: 1, totalReviews: 1 };
  await replaceLearningDocument(
    buildLearningDocument({
      cards: { [card.slug]: card },
      stats: { [stats.date]: stats },
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
    { wrapper: createTestWrapper().wrapper }
  );
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(view.result.current.queue.data).toEqual([]);
  expect(view.result.current.today.data).toEqual(stats);
  const writes = vi.spyOn(storage, 'setItem');
  await act(() => vi.advanceTimersByTimeAsync(15_000));
  expect(view.result.current.queue.data).toEqual([card]);
  expect(view.result.current.today.data).toBeNull();
  expect(view.result.current.history.data).toMatchObject([{ date: '2024-03-16', totalReviews: 0 }]);
  expect(view.result.current.upcoming.data).toEqual([{ date: '2024-03-16', count: 1 }]);
  expect(writes).not.toHaveBeenCalled();
  view.unmount();
});

it('keeps a successful local save successful when refreshing the cache fails', async () => {
  await startBackground();
  const { result } = renderHook(() => ({ cards: useCardsQuery(), rate: useRateCardMutation() }), {
    wrapper: createTestWrapper().wrapper,
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
  const status = {
    lastSyncTime: null,
    lastSyncDirection: null,
    syncInProgress: true,
    lastError: null as string | null,
  };
  messages.handle('getGistSyncStatus', () => status);
  const view = renderHook(() => useGistSyncStatusQuery(), { wrapper: createTestWrapper().wrapper });
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(view.result.current.data?.syncInProgress).toBe(true);
  status.syncInProgress = false;
  status.lastError = 'Network unavailable';
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
  onlineManager.setOnline(false);
  const { result } = renderHook(() => ({ config: useGistSyncConfigQuery(), toggle: useSetGistSyncEnabledMutation() }), {
    wrapper: createTestWrapper().wrapper,
  });
  await waitFor(() => expect(result.current.config.data?.enabled).toBe(true));
  act(() => result.current.toggle.mutate(false));
  await waitFor(() => expect(result.current.config.data?.enabled).toBe(false));
  expect(result.current.toggle.isSuccess).toBe(true);
  expect(github.get).not.toHaveBeenCalled();
});
