import * as catalog from '@/shared/catalog';
/**
 * @vitest-environment happy-dom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { getBadgeState } from '@/background/badge';
import backgroundEntry from '@/entrypoints/background/index';
import { background } from '@/shared/background-service';
import { STORAGE_KEYS } from '@/shared/storage';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { createMockCard } from '@/test/utils/card-mocks';
import { testCatalog } from '@/test/utils/catalog-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createServiceMock } from '@/test/utils/service-mocks';
import { createPopupTestWrapper, createTestWrapper } from '@/test/utils/test-wrapper';
import { useCardsQuery, useReviewQueueQuery } from '../cards';
import { useNoteQuery } from '../notes';
import { useSettingsQuery } from '../settings';

vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));
vi.mock('@/shared/background-service');

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
    card.fsrs.due = new Date(slug === 'future' ? '2024-03-16T00:00:00' : '2024-03-15T23:59:59.999').getTime();
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
    expect(await getBadgeState()).toEqual({ count: 2, nextRefreshAt: new Date('2024-03-16T00:00:00').getTime() });
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
    { frontendId: '1', domain: 'leetcode.com' as const },
    { frontendId: 'unknown', domain: 'leetcode.com' as const },
    { frontendId: '3', domain: 'leetcode.cn' as const },
  ])('isolates catalog errors for $frontendId on $domain', async (problem) => {
    const card = createMockCard(State.Review, { ...problem, note: 'Keep my solution' });
    const unavailable = problem.frontendId === '1';
    if (unavailable)
      vi.spyOn(catalog, 'getProblemsByFrontendIds').mockRejectedValueOnce(new Error('Catalog unavailable'));
    await background.importData(
      JSON.stringify(
        buildLearningDocument({
          cards: { 1: createMockCard(State.Review), [card.frontendId]: card },
          settings: { language: 'zh-CN' },
        })
      )
    );
    const view = renderHook(
      () => ({
        cards: useCardsQuery(),
        queue: useReviewQueueQuery(),
        note: useNoteQuery(card.frontendId),
        settings: useSettingsQuery(),
      }),
      {
        wrapper: createPopupTestWrapper().wrapper,
      }
    );
    const error = unavailable ? 'Catalog unavailable' : `Unknown problem: ${card.frontendId} on ${card.domain}`;
    await waitFor(() => expect(view.result.current.cards.error?.message).toBe(error));
    expect(view.result.current.queue.error?.message).toBe(error);
    expect(view.result.current.note.data).toBe('Keep my solution');
    expect(view.result.current.settings.data.language).toBe('zh-CN');
  });
});

it('shares one document read and catalog batch across cards, queue, notes, and settings', async () => {
  createServiceMock(background).reset();
  const cards = [
    createMockCard(State.New, { frontendId: '1', domain: 'leetcode.com', note: 'Shared note' }),
    createMockCard(State.New, { frontendId: '2', domain: 'leetcode.cn' }),
  ];
  await storage.setItem(STORAGE_KEYS.learningDocument, buildLearningDocument({ cards: { 1: cards[0], 2: cards[1] } }));
  const reads = vi.spyOn(storage, 'getItem');
  const lookups = vi.spyOn(catalog, 'getProblemsByFrontendIds');
  const view = renderHook(
    () => ({
      cards: useCardsQuery(),
      queue: useReviewQueueQuery(),
      note: useNoteQuery('1'),
      settings: useSettingsQuery(),
    }),
    { wrapper: createTestWrapper().wrapper }
  );
  await waitFor(() => expect(view.result.current.queue.data).toBeDefined());
  expect(view.result.current.cards.data).toEqual(cards.map((card, index) => ({ ...testCatalog[index], ...card })));
  expect(view.result.current.queue.data).toEqual(view.result.current.cards.data);
  expect(view.result.current.note.data).toBe('Shared note');
  expect(background.waitForInitialization).not.toHaveBeenCalled();
  expect(reads.mock.calls.filter(([key]) => key === STORAGE_KEYS.learningDocument)).toHaveLength(1);
  expect(lookups).toHaveBeenCalledTimes(1);
});
