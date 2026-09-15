import { initializeCatalog } from '@/shared/catalog';
/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from '#imports';
import { getBadgeState } from '@/background/badge';
import background from '@/entrypoints/background/index';
import { onMessage, sendMessage } from '@/shared/messages';
import { STORAGE_KEYS } from '@/shared/storage';
import { buildProblemDescriptor, createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { createMessageMock } from '@/test/utils/message-mocks';
import { createPopupTestWrapper } from '@/test/utils/test-wrapper';
import { useCardsQuery, useReviewQueueQuery } from '../cards';
import { useNoteQuery } from '../notes';
import { useSettingsQuery } from '../settings';

vi.mock('@/shared/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/messages')>()),
  onMessage: vi.fn(),
  sendMessage: vi.fn(() => Promise.resolve(undefined)),
}));

it('keeps popup and badge queues consistent without reading browser language', async () => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2024-03-15T10:00:00'));
  const languages = vi.fn(() => ['pl']);
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

describe('card queries through JSON messaging and background handlers', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    background.main();
    const messaging = createMessageMock(vi.mocked(sendMessage)).reset();
    for (const [name, listener] of vi.mocked(onMessage).mock.calls) {
      messaging.handle(name, (data) => listener({ id: 1, type: name, data, timestamp: 0, sender: {} }));
    }
    await sendMessage('waitForInitialization');
  });

  it('keeps learning data accessible when a saved problem is absent from the catalog', async () => {
    const card = createMockCard(State.Review, { frontendId: 'unknown', note: 'Keep my solution' });
    await sendMessage('importData', {
      jsonData: JSON.stringify(buildLearningDocument({ cards: { unknown: card }, settings: { language: 'de' } })),
    });
    const view = renderHook(() => ({ cards: useCardsQuery(), note: useNoteQuery('unknown') }), {
      wrapper: createPopupTestWrapper().wrapper,
    });
    await waitFor(() => expect(view.result.current.cards.error?.message).toContain('Unknown problem'));
    expect(view.result.current.note.data).toBe('Keep my solution');
    const settings = renderHook(() => useSettingsQuery(), { wrapper: createPopupTestWrapper().wrapper });
    await waitFor(() => expect(settings.result.current.data.language).toBe('de'));
  });

  it.each([State.Learning, State.Relearning])(
    'refreshes an empty queue when a state %i card becomes due',
    async (state) => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
      vi.setSystemTime(new Date('2024-03-15T10:00:00'));
      const card = createMockCard(state);
      card.fsrs.due = Date.now() + 10_000;
      await sendMessage('importData', {
        jsonData: JSON.stringify(buildLearningDocument({ cards: { [card.frontendId]: card } })),
      });
      const view = renderHook(() => useReviewQueueQuery(), { wrapper: createPopupTestWrapper().wrapper });

      try {
        await act(() => vi.advanceTimersByTimeAsync(1));
        await vi.waitFor(() => expect(view.result.current.isSuccess).toBe(true));
        expect(view.result.current.data).toEqual([]);

        await act(() => vi.advanceTimersByTimeAsync(15_000));
        await vi.waitFor(() => expect(view.result.current.data).toEqual([{ ...card, ...buildProblemDescriptor() }]));
      } finally {
        view.unmount();
        vi.useRealTimers();
      }
    }
  );
});

beforeEach(initializeCatalog);
