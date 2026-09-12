import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { type LearningDocument, learningDocumentSchema } from '@/domain/learning-document';
import { createDailyStats } from '@/domain/statistics';
import { type MessageData, type MessageName, type MessageResult, onMessage } from '@/infrastructure/browser/messages';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import background from '../index';

vi.mock('@/infrastructure/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/browser/messages')>()),
  onMessage: vi.fn(),
}));

function dispatch<Name extends MessageName>(name: Name, data?: MessageData<Name>): Promise<MessageResult<Name>> {
  const listener = vi.mocked(onMessage).mock.calls.find(([registered]) => registered === name)?.[1];
  if (!listener) {
    throw new Error(`Missing listener for ${name}`);
  }
  return Promise.resolve(
    listener({ id: 1, type: name, data: data as MessageData<MessageName>, timestamp: 0, sender: {} })
  ) as Promise<MessageResult<Name>>;
}

describe('document learning through background commands', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    vi.mocked(onMessage).mockClear();
    const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'get').mockImplementation(async (keys) => structuredClone(await get(keys)));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2024-03-15T12:00:00'));
    await replaceLearningDocument({ schemaVersion: 6, cards: {}, stats: {}, settings: { badgeEnabled: false } });
    background.main();
    await dispatch('getSettings');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('publishes a complete review only after the document replacement succeeds', async () => {
    const before = await readLearningDocument();
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const set = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementationOnce(async (items) => {
      started.resolve();
      await release.promise;
      await set(items);
    });
    const settled = vi.fn();
    const pending = dispatch('rateCard', { input: { ...buildProblem(), rating: Rating.Good } });
    void pending.then(settled);
    await started.promise;

    expect(settled).not.toHaveBeenCalled();
    expect(await dispatch('getAllCards')).toEqual([]);
    expect(await dispatch('getTodayStats')).toBeNull();
    expect(await readLearningDocument()).toEqual(before);
    release.resolve();
    const result = await pending;

    expect(result.card).toMatchObject({ ...buildProblem(), createdAt: Date.now(), paused: false });
    expect(result.card.fsrs).toEqual({
      due: new Date('2024-03-15T12:10:00').getTime(),
      last_review: Date.now(),
      stability: 2.3065,
      difficulty: 2.11810397,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 1,
      lapses: 0,
      learning_steps: 1,
      state: State.Learning,
    });
    expect(result.shouldRequeue).toBe(false);
    expect(await dispatch('getAllCards')).toEqual([result.card]);
    const stats = await dispatch('getTodayStats');
    expect(stats).toEqual({
      date: '2024-03-15',
      totalReviews: 1,
      newCards: 1,
      reviewedCards: 0,
      streak: 1,
      gradeBreakdown: { 1: 0, 2: 0, 3: 1, 4: 0 },
    });
    expect(await readLearningDocument()).toEqual({
      ...before,
      cards: { [result.card.slug]: result.card },
      stats: { '2024-03-15': stats },
      dataUpdatedAt: new Date().toISOString(),
    });
    expect(writes).toHaveBeenCalledExactlyOnceWith({
      [STORAGE_KEYS.learningDocument.slice('local:'.length)]: await readLearningDocument(),
    });
  });

  it('preserves card identity and unrelated data through card and note edits', async () => {
    const { embedded, payload } = mixedRecordBackup();
    const original: LearningDocument = {
      ...embedded,
      schemaVersion: 6,
      settings: { badgeEnabled: false, theme: 'dark' },
      dataUpdatedAt: payload.dataUpdatedAt,
    };
    await replaceLearningDocument(original);
    const others = Object.values(original.cards);
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    const problem = buildProblem({ slug: 'new-problem' });
    const card = await dispatch('addCard', { problem });
    expect(await dispatch('getAllCards')).toEqual([...others, card]);
    expect(card.fsrs).toEqual({
      due: Date.now(),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      learning_steps: 0,
      last_review: undefined,
    });
    expect(await dispatch('addCard', { problem: { ...problem, name: 'Changed', domain: 'leetcode.cn' } })).toEqual(
      card
    );
    expect(writes).toHaveBeenCalledTimes(1);
    await dispatch('saveNote', { slug: card.slug, text: '  solution\n\t' });
    expect(await dispatch('getNote', { slug: card.slug })).toBe('  solution\n\t');
    const paused = await dispatch('setPauseStatus', { slug: card.slug, paused: true });
    expect(paused).toEqual({ ...card, paused: true, note: '  solution\n\t' });
    vi.setSystemTime(new Date('2024-03-16T12:00:00'));
    const delayed = await dispatch('delayCard', { slug: card.slug, days: 2 });
    expect(delayed).toEqual({ ...paused, fsrs: { ...paused.fsrs, due: new Date('2024-03-17T12:00:00').getTime() } });
    expect(await dispatch('setPauseStatus', { slug: card.slug, paused: false })).toEqual({ ...delayed, paused: false });
    await dispatch('saveNote', { slug: card.slug, text: 'a'.repeat(500) });
    await expect(dispatch('saveNote', { slug: card.slug, text: 'a'.repeat(501) })).rejects.toThrow('maximum length');
    expect(await dispatch('getNote', { slug: card.slug })).toBe('a'.repeat(500));
    await dispatch('saveNote', { slug: card.slug, text: '' });
    expect(await dispatch('getNote', { slug: card.slug })).toBeNull();
    await dispatch('saveNote', { slug: card.slug, text: 'replacement' });
    await dispatch('deleteNote', { slug: card.slug });
    expect(await dispatch('getNote', { slug: card.slug })).toBeNull();
    await dispatch('saveNote', { slug: card.slug, text: 'removed with card' });
    await dispatch('removeCard', { slug: card.slug });
    expect(await dispatch('getAllCards')).toEqual(others);
    expect(await dispatch('getNote', { slug: card.slug })).toBeNull();
    expect(await readLearningDocument()).toEqual({ ...original, dataUpdatedAt: new Date().toISOString() });
    expect(writes).toHaveBeenCalledTimes(11);
    for (const [index, [items]] of writes.mock.calls.entries()) {
      expect(Object.keys(items)).toEqual([STORAGE_KEYS.learningDocument.slice('local:'.length)]);
      const document = learningDocumentSchema.parse(
        Reflect.get(items, STORAGE_KEYS.learningDocument.slice('local:'.length))
      );
      expect(document).toMatchObject({ cards: original.cards, stats: original.stats, settings: original.settings });
      expect(document.dataUpdatedAt).toBe(
        new Date(index < 3 ? '2024-03-15T12:00:00' : '2024-03-16T12:00:00').toISOString()
      );
    }
  });

  it('uses one document and time for queue eligibility and the daily allowance across midnight', async () => {
    vi.setSystemTime(new Date('2024-03-14T23:59:59.999'));
    const cards = ['new-a', 'new-b', 'future', 'review', 'paused'].map((slug) => {
      const card = createMockCard(slug === 'review' ? State.Review : State.New, { slug, paused: slug === 'paused' });
      if (slug === 'future') {
        card.fsrs.due = new Date('2024-03-15T00:00:00').getTime();
      }
      return card;
    });
    const document: LearningDocument = {
      schemaVersion: 6,
      cards: Object.fromEntries(cards.map((card) => [card.slug, card])),
      stats: { '2024-03-14': { ...createDailyStats('2024-03-14', undefined), newCards: 1 } },
      settings: { maxNewCardsPerDay: 2 },
    };
    await replaceLearningDocument(document);
    const get = storage.getItem.bind(storage);
    const reads = vi.spyOn(storage, 'getItem').mockImplementationOnce(async (key) => {
      const result = await get(key);
      vi.setSystemTime(new Date('2024-03-15T00:00:00'));
      await replaceLearningDocument({ ...document, settings: { maxNewCardsPerDay: 3 } });
      return result;
    });

    expect((await dispatch('getReviewQueue')).map((card) => card.slug)).toEqual(['new-a', 'review']);
    expect(reads).toHaveBeenCalledExactlyOnceWith(STORAGE_KEYS.learningDocument);
    expect((await dispatch('getReviewQueue')).map((card) => card.slug)).toEqual(['new-a', 'new-b', 'review', 'future']);
    await replaceLearningDocument({ ...document, settings: { maxNewCardsPerDay: 0 } });
    expect((await dispatch('getReviewQueue')).map((card) => card.slug)).toEqual(['review']);
    await replaceLearningDocument({ ...document, settings: {} });
    expect((await dispatch('getReviewQueue')).map((card) => card.slug)).toEqual(['new-a', 'new-b', 'review', 'future']);
  });

  it('uses captured settings and the exact due time for editor reset, including domain and pause checks', async () => {
    const card = createMockCard(State.Relearning);
    card.fsrs.due = Date.now() + 1;
    const document: LearningDocument = {
      schemaVersion: 6,
      cards: { [card.slug]: card },
      stats: {},
      settings: { resetEditorOnDueReview: true },
    };
    await replaceLearningDocument(document);
    const get = storage.getItem.bind(storage);
    const reads = vi.spyOn(storage, 'getItem').mockImplementationOnce(async (key) => {
      const result = await get(key);
      vi.setSystemTime(card.fsrs.due);
      await replaceLearningDocument({ ...document, settings: { resetEditorOnEveryProblem: true } });
      return result;
    });

    expect(await dispatch('shouldResetEditor', card)).toBe(false);
    expect(reads).toHaveBeenCalledExactlyOnceWith(STORAGE_KEYS.learningDocument);
    await replaceLearningDocument(document);
    expect(await dispatch('shouldResetEditor', card)).toBe(true);
    expect(await dispatch('shouldResetEditor', { ...card, domain: 'leetcode.cn' })).toBe(false);
    expect(await dispatch('shouldResetEditor', { ...card, slug: 'missing' })).toBe(false);
    await replaceLearningDocument({ ...document, cards: { [card.slug]: { ...card, paused: true } } });
    expect(await dispatch('shouldResetEditor', card)).toBe(false);
    await replaceLearningDocument({ ...document, settings: {} });
    expect(await dispatch('shouldResetEditor', card)).toBe(false);
    await replaceLearningDocument({ ...document, cards: {}, settings: { resetEditorOnEveryProblem: true } });
    expect(await dispatch('shouldResetEditor', card)).toBe(true);
  });

  it('preserves card-state, history, and upcoming statistics results', async () => {
    expect(await dispatch('getCardStateStats')).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
    const cards = [
      createMockCard(State.New, { slug: 'overdue' }),
      createMockCard(State.Learning, { slug: 'today' }),
      createMockCard(State.Review, { slug: 'tomorrow' }),
      createMockCard(State.Relearning, { slug: 'paused', paused: true }),
      createMockCard(State.Review, { slug: 'outside' }),
    ];
    cards[0].fsrs.due = new Date('2024-03-14T12:00:00').getTime();
    cards[2].fsrs.due = new Date('2024-03-16T00:00:00').getTime();
    cards[4].fsrs.due = new Date('2024-03-17T00:00:00').getTime();
    const yesterday = {
      date: '2024-03-14',
      streak: 7,
      totalReviews: 3,
      newCards: 1,
      reviewedCards: 2,
      gradeBreakdown: { 1: 1, 2: 0, 3: 2, 4: 0 },
    };
    await replaceLearningDocument({
      schemaVersion: 6,
      cards: Object.fromEntries(cards.map((card) => [card.slug, card])),
      stats: { '2024-03-14': yesterday },
      settings: {},
    });

    expect(await dispatch('getCardStateStats')).toEqual({ 0: 1, 1: 1, 2: 2, 3: 1 });
    expect(await dispatch('getTodayStats')).toBeNull();
    expect(await dispatch('getLastNDaysStats', { days: 2 })).toEqual([
      yesterday,
      {
        date: '2024-03-15',
        streak: 0,
        totalReviews: 0,
        newCards: 0,
        reviewedCards: 0,
        gradeBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0 },
      },
    ]);
    expect(await dispatch('getNextNDaysStats', { days: 2 })).toEqual([
      { date: '2024-03-15', count: 2 },
      { date: '2024-03-16', count: 1 },
    ]);
    expect(await dispatch('getLastNDaysStats', { days: 0 })).toEqual([]);
    expect(await dispatch('getNextNDaysStats', { days: 0 })).toEqual([]);
  });

  it.each([
    ['add', () => dispatch('addCard', { problem: buildProblem({ slug: 'new' }) })],
    ['rate new', () => dispatch('rateCard', { input: { ...buildProblem({ slug: 'new' }), rating: Rating.Good } })],
    ['rate existing', () => dispatch('rateCard', { input: { ...buildProblem(), rating: Rating.Again } })],
    ['delay', () => dispatch('delayCard', { slug: 'two-sum', days: 2 })],
    ['resume', () => dispatch('setPauseStatus', { slug: 'two-sum', paused: false })],
    ['remove', () => dispatch('removeCard', { slug: 'two-sum' })],
    ['save note', () => dispatch('saveNote', { slug: 'two-sum', text: '  new note\n' })],
    ['delete note', () => dispatch('deleteNote', { slug: 'two-sum' })],
  ])('leaves all saved data intact when %s is rejected and accepts the next command', async (_name, edit) => {
    const { embedded, payload } = mixedRecordBackup();
    const document: LearningDocument = {
      ...embedded,
      schemaVersion: 6,
      settings: { badgeEnabled: false },
      dataUpdatedAt: payload.dataUpdatedAt,
    };
    await replaceLearningDocument(document);
    await storage.setItem(STORAGE_KEYS.gistConnection, { pat: 'secret', gistId: 'gist', enabled: true });
    await storage.setItem(STORAGE_KEYS.lastSyncTime, payload.dataUpdatedAt);
    const localBefore = await fakeBrowser.storage.local.get();
    const syncBefore = await fakeBrowser.storage.sync.get();
    const error = new Error('Write failed');
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(error);

    await expect(edit()).rejects.toBe(error);
    expect(await dispatch('getAllCards')).toEqual(Object.values(document.cards));
    expect(await dispatch('getNote', { slug: 'two-sum' })).toBe('Keep this note');
    expect(await dispatch('getTodayStats')).toBeNull();
    expect(await fakeBrowser.storage.local.get()).toEqual(localBefore);
    expect(await fakeBrowser.storage.sync.get()).toEqual(syncBefore);
    expect(writes).toHaveBeenCalledOnce();

    await edit();
    expect(writes).toHaveBeenCalledTimes(2);
    expect(await readLearningDocument()).not.toEqual(document);
    expect(await fakeBrowser.storage.sync.get()).toEqual(syncBefore);
    expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe(payload.dataUpdatedAt);
  });

  it.each(['delay overflow', 'statistics overflow', 'invalid clock'])(
    'rejects %s before any write and preserves the previous document',
    async (failure) => {
      const card = createMockCard(State.New, buildProblem());
      const document: LearningDocument = {
        schemaVersion: 6,
        cards: { [card.slug]: card },
        settings: { badgeEnabled: false },
        stats: {
          '2024-03-15': { ...createDailyStats('2024-03-15', undefined), totalReviews: Number.MAX_SAFE_INTEGER },
        },
      };
      await replaceLearningDocument(document);
      const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
      if (failure === 'invalid clock') {
        vi.setSystemTime(Number.NaN);
      }
      const edit =
        failure === 'delay overflow'
          ? dispatch('delayCard', { slug: card.slug, days: Number.MAX_SAFE_INTEGER })
          : dispatch('rateCard', { input: { ...buildProblem(), rating: Rating.Good } });

      await expect(edit).rejects.toThrow();
      expect(writes).not.toHaveBeenCalled();
      expect(await dispatch('getAllCards')).toEqual([card]);
      expect(await readLearningDocument()).toEqual(document);
    }
  );

  it('preserves missing-card errors and harmless note deletion', async () => {
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    expect(await dispatch('getNote', { slug: 'missing' })).toBeNull();
    await dispatch('deleteNote', { slug: 'missing' });
    await expect(dispatch('saveNote', { slug: 'missing', text: '' })).rejects.toThrow('not found');
    await expect(dispatch('delayCard', { slug: 'missing', days: 1 })).rejects.toThrow('not found');
    await expect(dispatch('setPauseStatus', { slug: 'missing', paused: true })).rejects.toThrow('not found');
    expect(writes).not.toHaveBeenCalled();
    await dispatch('removeCard', { slug: 'missing' });
    expect(await dispatch('getAllCards')).toEqual([]);
    const card = await dispatch('addCard', { problem: buildProblem() });
    writes.mockClear();
    await dispatch('deleteNote', { slug: card.slug });
    expect(writes).not.toHaveBeenCalled();
  });

  it.each(['addCard', 'rateCard'] as const)(
    '%s rejects an unpersistable card result before writing',
    async (command) => {
      const before = await readLearningDocument();
      const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
      const problem = buildProblem({ slug: '__proto__' });
      const edit =
        command === 'addCard'
          ? dispatch(command, { problem })
          : dispatch(command, { input: { ...problem, rating: Rating.Good } });

      await expect(edit).rejects.toThrow('not found');
      expect(writes).not.toHaveBeenCalled();
      expect(await dispatch('getAllCards')).toEqual([]);
      expect(await readLearningDocument()).toEqual(before);
    }
  );

  it.each([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const)(
    'preserves repeated scheduling and daily statistics for rating %s',
    async (rating) => {
      const card = await dispatch('addCard', { problem: buildProblem() });
      await dispatch('saveNote', { slug: card.slug, text: '  retained\n' });
      const first = await dispatch('rateCard', { input: { ...buildProblem({ name: 'Changed' }), rating } });
      expect(first.card).toMatchObject({
        id: card.id,
        name: card.name,
        createdAt: card.createdAt,
        note: '  retained\n',
      });
      expect(first.card.fsrs.reps).toBe(1);
      expect(first.card.fsrs.last_review).toBe(card.createdAt);
      expect(first.card.fsrs.due).toBeGreaterThan(card.createdAt);
      expect(first.shouldRequeue).toBe(false);
      vi.setSystemTime(first.card.fsrs.due - 1);
      expect(await dispatch('getReviewQueue')).toEqual([]);
      vi.setSystemTime(first.card.fsrs.due);
      expect(await dispatch('getReviewQueue')).toEqual([first.card]);
      // Another attempt on the same review day counts as a reviewed card.
      vi.setSystemTime(card.createdAt);
      const second = await dispatch('rateCard', { input: { ...buildProblem(), rating } });
      expect(second.card.fsrs.reps).toBe(2);
      expect(await dispatch('getAllCards')).toEqual([second.card]);
      expect(await dispatch('getTodayStats')).toEqual({
        date: '2024-03-15',
        streak: 1,
        totalReviews: 2,
        newCards: 1,
        reviewedCards: 1,
        gradeBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, [rating]: 2 },
      });
    }
  );

  it.each([
    ['2024-03-14T23:59:59.999', '2024-03-13', '2024-03-14', '2024-03-15'],
    ['2023-12-31T23:59:59.999', '2023-12-30', '2023-12-31', '2024-01-01'],
    ['2024-03-10T23:59:59.999', '2024-03-09', '2024-03-10', '2024-03-11'],
    ['2024-11-03T23:59:59.999', '2024-11-02', '2024-11-03', '2024-11-04'],
  ])(
    'keeps review creation, scheduling, streak and edit time on the starting day at %s',
    async (instant, yesterday, today, tomorrow) => {
      const now = new Date(instant);
      vi.setSystemTime(now);
      const document: LearningDocument = {
        schemaVersion: 6,
        cards: {},
        settings: { badgeEnabled: false },
        stats: {
          [yesterday]: { ...createDailyStats(yesterday, undefined), totalReviews: 1, reviewedCards: 1, streak: 7 },
        },
      };
      await replaceLearningDocument(document);
      const get = storage.getItem.bind(storage);
      vi.spyOn(storage, 'getItem').mockImplementationOnce(async (key) => {
        const result = await get(key);
        vi.setSystemTime(new Date(`${tomorrow}T00:00:00`));
        return result;
      });

      const { card } = await dispatch('rateCard', { input: { ...buildProblem(), rating: Rating.Good } });
      expect(card.createdAt).toBe(now.getTime());
      expect(card.fsrs.last_review).toBe(now.getTime());
      expect(await dispatch('getTodayStats')).toBeNull();
      expect(await readLearningDocument()).toMatchObject({
        dataUpdatedAt: now.toISOString(),
        stats: { ...document.stats, [today]: { newCards: 1, totalReviews: 1, streak: 8 } },
      });
    }
  );

  it.each(['getLastNDaysStats', 'getNextNDaysStats'] as const)(
    '%s uses the captured document and day when storage changes during a read',
    async (command) => {
      const card = createMockCard(State.Review);
      const document: LearningDocument = {
        schemaVersion: 6,
        cards: { [card.slug]: card },
        settings: {},
        stats: { '2024-03-15': { ...createDailyStats('2024-03-15', undefined), totalReviews: 3 } },
      };
      await replaceLearningDocument(document);
      const get = storage.getItem.bind(storage);
      const reads = vi.spyOn(storage, 'getItem').mockImplementationOnce(async (key) => {
        const result = await get(key);
        vi.setSystemTime(new Date('2024-03-16T00:00:00'));
        await replaceLearningDocument({ ...document, cards: {}, stats: {} });
        return result;
      });

      const expected =
        command === 'getLastNDaysStats' ? document.stats['2024-03-15'] : { date: '2024-03-15', count: 1 };
      expect(await dispatch(command, { days: 1 })).toEqual([expected]);
      expect(reads).toHaveBeenCalledExactlyOnceWith(STORAGE_KEYS.learningDocument);
    }
  );
});
