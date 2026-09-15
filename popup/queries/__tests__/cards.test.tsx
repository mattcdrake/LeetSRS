import { initializeCatalog } from '@/shared/catalog';
/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { IDBDatabase } from 'fake-indexeddb';
import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { getBadgeState } from '@/background/badge';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { STORAGE_KEYS } from '@/shared/storage';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildCatalogProblem, createMockCard } from '@/test/utils/card-mocks';
import { testCatalog } from '@/test/utils/catalog-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useCardsQuery, useReviewQueueQuery } from '../cards';
import { useNoteQuery } from '../notes';
import { useSettingsQuery } from '../settings';

vi.mock('@webext-core/proxy-service');
vi.mock('@/shared/background-service');

it('loads saved cards with one catalog batch', async () => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  const cards = [
    createMockCard(State.Review, { frontendId: '1', domain: 'leetcode.com' }),
    createMockCard(State.Review, { frontendId: '2', domain: 'leetcode.cn' }),
  ];
  await storage.setItem(STORAGE_KEYS.learningDocument, buildLearningDocument({ cards: { 1: cards[0], 2: cards[1] } }));
  const open = vi.spyOn(indexedDB, 'open');
  const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
  const view = renderHook(() => useCardsQuery(), { wrapper: createPopupTestWrapper().wrapper });
  try {
    await act(() => vi.advanceTimersByTimeAsync(1));
    await vi.waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(view.result.current.data).toEqual([
      { ...testCatalog[0], ...cards[0] },
      { ...testCatalog[1], ...cards[1] },
    ]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledExactlyOnceWith('problems', 'readonly');
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});

it('keeps popup and badge queues consistent without reading browser language', async () => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2024-03-15T10:00:00'));
  const languages = vi.fn(() => ['en']);
  vi.stubGlobal('navigator', {
    get languages() {
      return languages();
    },
  });
  const cards = ['new-a', 'new-b', 'review', 'future', 'paused'].map((slug) => {
    const card = createMockCard(slug === 'review' ? State.Review : State.New, {
      frontendId: slug,
      paused: slug === 'paused',
    });
    card.fsrs.due = slug === 'future' ? Date.now() + 1000 : Date.now();
    return card;
  });
  const document = buildLearningDocument({
    cards: Object.fromEntries(cards.map((card) => [card.frontendId, card])),
    settings: { maxNewCardsPerDay: 1 },
  });
  await storage.setItem(STORAGE_KEYS.learningDocument, document);
  const view = renderHook(() => useReviewQueueQuery(), { wrapper: createPopupTestWrapper().wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.map((card) => card.frontendId)).toEqual(['new-a', 'review']));
    expect(await getBadgeState()).toEqual({ count: 2, nextDueAt: Date.now() + 1000 });
    expect(languages).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

describe('card queries through the background service', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    backgroundEntry.main();
    const service = createServiceMock(background).reset();
    service.use(getRegisteredBackground());
    await background.waitForInitialization();
  });

  it.each([
    { frontendId: 'unknown', domain: 'leetcode.com' as const },
    { frontendId: '3', domain: 'leetcode.cn' as const },
  ])('keeps learning data accessible when $frontendId is unavailable on $domain', async (problem) => {
    const card = createMockCard(State.Review, { ...problem, note: 'Keep my solution' });
    await background.importData(
      JSON.stringify(
        buildLearningDocument({
          cards: { 1: createMockCard(State.Review), [card.frontendId]: card },
          settings: { language: 'zh-CN' },
        })
      )
    );
    const view = renderHook(
      () => ({ cards: useCardsQuery(), queue: useReviewQueueQuery(), note: useNoteQuery(card.frontendId) }),
      {
        wrapper: createPopupTestWrapper().wrapper,
      }
    );
    const error = `Unknown problem: ${card.frontendId} on ${card.domain}`;
    await waitFor(() => expect(view.result.current.cards.error?.message).toBe(error));
    expect(view.result.current.queue.error?.message).toBe(error);
    expect(view.result.current.note.data).toBe('Keep my solution');
    const settings = renderHook(() => useSettingsQuery(), { wrapper: createPopupTestWrapper().wrapper });
    await waitFor(() => expect(settings.result.current.data.language).toBe('zh-CN'));
  });

  it.each([State.Learning, State.Relearning])(
    'refreshes an empty queue when a state %i card becomes due',
    async (state) => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      const card = createMockCard(state);
      card.fsrs.due = Date.now() + 10_000;
      await background.importData(JSON.stringify(buildLearningDocument({ cards: { [card.frontendId]: card } })));
      const view = renderHook(() => useReviewQueueQuery(), { wrapper: createPopupTestWrapper().wrapper });

      try {
        await act(() => vi.advanceTimersByTimeAsync(1));
        await vi.waitFor(() => expect(view.result.current.isSuccess).toBe(true));
        expect(view.result.current.data).toEqual([]);

        await act(() => vi.advanceTimersByTimeAsync(15_000));
        await vi.waitFor(() => expect(view.result.current.data).toEqual([{ ...card, ...buildCatalogProblem() }]));
      } finally {
        view.unmount();
        vi.useRealTimers();
      }
    }
  );
});

beforeEach(initializeCatalog);
