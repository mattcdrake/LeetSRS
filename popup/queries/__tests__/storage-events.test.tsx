/** @vitest-environment happy-dom */
import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { gistConnectionItem } from '@/shared/gist-sync';
import { learningDocumentItem, replaceLearningDocument } from '@/shared/learning-document';
import { requireDefined } from '@/test/utils/assertions';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildCatalogProblem, buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { seedGithubAuthorization } from '@/test/utils/github-auth';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useCardsQuery, useRateCardMutation, useReviewQueueQuery } from '../cards';
import { useGistSyncConfigQuery, useGistSyncStatusQuery } from '../gist-sync';
import { useNoteQuery } from '../notes';
import { useTodayReviewActivityQuery } from '../review-activity';
import { useSettingsQuery, useUpdateSettingsMutation } from '../settings';

const github = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('@/background/github-gists', () => ({ gistsApi: () => github }));
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

it('waits for initialization before showing learning data', async () => {
  await learningDocumentItem.removeValue();
  const ready = Promise.withResolvers<void>();
  service.resolve('waitForInitialization', ready.promise);
  const { result } = renderHook(() => useCardsQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await waitFor(() => expect(background.waitForInitialization).toHaveBeenCalled());
  expect(result.current.isLoading).toBe(true);
  expect(result.current.data).toBeUndefined();
  expect(await learningDocumentItem.getValue()).toBeNull();
  await act(async () => {
    await replaceLearningDocument(buildLearningDocument());
    ready.resolve();
  });
  await waitFor(() => expect(result.current.data).toEqual([]));
});

it('reports initialization failure without presenting default data', async () => {
  service.handle('waitForInitialization', () => {
    throw new Error('Conversion failed');
  });
  const { result } = renderHook(() => useCardsQuery(), { wrapper: createPopupTestWrapper().wrapper });
  await waitFor(() => expect(result.current.error?.message).toBe('Conversion failed'));
  expect(result.current.data).toBeUndefined();
  expect(await learningDocumentItem.getValue()).toBeNull();
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
  await gistConnectionItem.setValue({ accountId: 1, gistId: 'gist', enabled: true });
  await waitFor(() => expect(result.current.config.data?.enabled).toBe(true));
  const remote = buildLearningDocument({
    settings: { maxNewCardsPerDay: 9 },
    dataUpdatedAt: '2099-01-01T00:00:00.000Z',
  });
  github.get.mockResolvedValue({ files: { 'leetsrs-backup.json': { content: JSON.stringify(remote) } } });
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
    const reads = vi.spyOn(learningDocumentItem, 'getValue');
    vi.mocked(fetch).mockClear();
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
    expect(fetch).not.toHaveBeenCalled();
    view.unmount();
  }
);
