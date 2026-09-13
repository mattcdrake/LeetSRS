import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { readLearningDocument, replaceLearningDocument } from '@/data/learning-document';
import { getReviewQueue } from '@/data/learning-queries';
import { STORAGE_KEYS } from '@/data/storage-keys';
import { formatLocalDate } from '@/domain/calendar';
import { type LearningDocument, learningDocumentSchema } from '@/domain/learning-document';
import { createDailyStats } from '@/domain/statistics';
import { onMessage } from '@/integrations/browser/messages';
import { requireDefined } from '@/test/utils/assertions';
import { dispatchBackgroundCommand as dispatch } from '@/test/utils/background-messages';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import background from '../../entrypoints/background/index';

vi.mock('@/integrations/browser/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/integrations/browser/messages')>()),
  onMessage: vi.fn(),
}));

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
    await dispatch('waitForInitialization');
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
    expect(Object.values((await readLearningDocument()).cards)).toEqual([]);
    expect((await readLearningDocument()).stats[formatLocalDate(new Date())] ?? null).toBeNull();
    expect(await readLearningDocument()).toEqual(before);
    release.resolve();
    await expect(pending).resolves.toBeUndefined();
    const card = requireDefined((await readLearningDocument()).cards['two-sum']);

    expect(card).toMatchObject({ ...buildProblem(), createdAt: Date.now(), paused: false });
    expect(card?.fsrs).toEqual({
      due: new Date('2024-03-18T12:00:00').getTime(),
      last_review: Date.now(),
      stability: 2.3065,
      difficulty: 2.11810397,
      elapsed_days: 0,
      scheduled_days: 3,
      reps: 1,
      lapses: 0,
      learning_steps: 0,
      state: State.Review,
    });
    expect(Object.values((await readLearningDocument()).cards)).toEqual([card]);
    const stats = (await readLearningDocument()).stats[formatLocalDate(new Date())] ?? null;
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
      cards: { [card.slug]: card },
      stats: { '2024-03-15': stats },
      dataUpdatedAt: new Date().toISOString(),
    });
    expect(writes).toHaveBeenCalledExactlyOnceWith({
      [STORAGE_KEYS.learningDocument.slice('local:'.length)]: await readLearningDocument(),
    });
  });

  it('preserves card identity and unrelated data through card and note edits', async () => {
    const original = buildLearningDocument({
      cards: { 'two-sum': createMockCard(State.Review, { slug: 'two-sum', paused: true, note: 'Keep this note' }) },
      stats: { '2024-01-01': createDailyStats('2024-01-01', undefined) },
      settings: { badgeEnabled: false, theme: 'dark' },
      dataUpdatedAt: '2024-01-15T10:00:00.000Z',
    });
    await replaceLearningDocument(original);
    const others = Object.values(original.cards);
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    const problem = buildProblem({ slug: 'new-problem' });
    await expect(dispatch('addCard', { problem })).resolves.toBeUndefined();
    const card = requireDefined((await readLearningDocument()).cards[problem.slug]);
    expect(Object.values((await readLearningDocument()).cards)).toEqual([...others, card]);
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
    await expect(
      dispatch('addCard', { problem: { ...problem, name: 'Changed', domain: 'leetcode.cn' } })
    ).resolves.toBeUndefined();
    expect(writes).toHaveBeenCalledTimes(1);
    await dispatch('saveNote', { slug: card.slug, text: '  solution\n\t' });
    expect((await readLearningDocument()).cards[card.slug]?.note ?? null).toBe('  solution\n\t');
    await expect(dispatch('setPauseStatus', { slug: card.slug, paused: true })).resolves.toBeUndefined();
    const paused = requireDefined((await readLearningDocument()).cards[card.slug]);
    expect(paused).toEqual({ ...card, paused: true, note: '  solution\n\t' });
    vi.setSystemTime(new Date('2024-03-16T12:00:00'));
    await expect(dispatch('delayCard', { slug: card.slug, days: 2 })).resolves.toBeUndefined();
    const delayed = requireDefined((await readLearningDocument()).cards[card.slug]);
    expect(delayed).toEqual({ ...paused, fsrs: { ...paused.fsrs, due: new Date('2024-03-17T12:00:00').getTime() } });
    await expect(dispatch('setPauseStatus', { slug: card.slug, paused: false })).resolves.toBeUndefined();
    expect((await readLearningDocument()).cards[card.slug]).toEqual({ ...delayed, paused: false });
    await dispatch('saveNote', { slug: card.slug, text: 'a'.repeat(500) });
    await expect(dispatch('saveNote', { slug: card.slug, text: 'a'.repeat(501) })).rejects.toThrow('maximum length');
    expect((await readLearningDocument()).cards[card.slug]?.note ?? null).toBe('a'.repeat(500));
    await dispatch('saveNote', { slug: card.slug, text: '' });
    expect((await readLearningDocument()).cards[card.slug]?.note ?? null).toBeNull();
    await dispatch('saveNote', { slug: card.slug, text: 'replacement' });
    await dispatch('deleteNote', { slug: card.slug });
    expect((await readLearningDocument()).cards[card.slug]?.note ?? null).toBeNull();
    await dispatch('saveNote', { slug: card.slug, text: 'removed with card' });
    await dispatch('removeCard', { slug: card.slug });
    expect(Object.values((await readLearningDocument()).cards)).toEqual(others);
    expect((await readLearningDocument()).cards[card.slug]?.note ?? null).toBeNull();
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

  it('keeps a review schedule, statistics, and edit timestamp on the captured day when a read crosses midnight', async () => {
    const now = new Date('2024-03-15T23:59:59.999');
    vi.setSystemTime(now);
    const get = storage.getItem.bind(storage);
    vi.spyOn(storage, 'getItem').mockImplementationOnce(async (key) => {
      const document = await get(key);
      vi.setSystemTime(new Date('2024-03-16T00:00:00'));
      return document;
    });

    await dispatch('rateCard', { input: { ...buildProblem(), rating: Rating.Good } });
    const card = requireDefined((await readLearningDocument()).cards['two-sum']);

    expect(card.createdAt).toBe(now.getTime());
    expect(card.fsrs.last_review).toBe(now.getTime());
    expect(card.fsrs.due).toBe(new Date('2024-03-18T23:59:59.999').getTime());
    expect(await readLearningDocument()).toMatchObject({
      cards: { [card.slug]: card },
      stats: { '2024-03-15': { totalReviews: 1, newCards: 1 } },
      dataUpdatedAt: now.toISOString(),
    });
    expect((await readLearningDocument()).stats[formatLocalDate(new Date())] ?? null).toBeNull();
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
    vi.spyOn(storage, 'getItem').mockImplementationOnce(async (key) => {
      const result = await get(key);
      vi.setSystemTime(new Date('2024-03-15T00:00:00'));
      await replaceLearningDocument({ ...document, settings: { maxNewCardsPerDay: 3 } });
      return result;
    });

    expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['new-a', 'review']);
    expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['new-a', 'new-b', 'review', 'future']);
    await replaceLearningDocument({ ...document, settings: { maxNewCardsPerDay: 0 } });
    expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['review']);
    await replaceLearningDocument({ ...document, settings: {} });
    expect((await getReviewQueue()).map((card) => card.slug)).toEqual(['new-a', 'new-b', 'review', 'future']);
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
    const document = buildLearningDocument({
      cards: { 'two-sum': createMockCard(State.Review, { slug: 'two-sum', paused: true, note: 'Keep this note' }) },
      stats: { '2024-01-01': createDailyStats('2024-01-01', undefined) },
      settings: { badgeEnabled: false },
      dataUpdatedAt: '2024-01-15T10:00:00.000Z',
    });
    await replaceLearningDocument(document);
    await storage.setItem(STORAGE_KEYS.gistConnection, { pat: 'secret', gistId: 'gist', enabled: true });
    await storage.setItem(STORAGE_KEYS.lastSyncTime, '2024-01-15T10:00:00.000Z');
    const localBefore = await fakeBrowser.storage.local.get();
    const syncBefore = await fakeBrowser.storage.sync.get();
    const error = new Error('Write failed');
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(error);

    await expect(edit()).rejects.toBe(error);
    expect(Object.values((await readLearningDocument()).cards)).toEqual(Object.values(document.cards));
    expect((await readLearningDocument()).cards['two-sum']?.note ?? null).toBe('Keep this note');
    expect((await readLearningDocument()).stats[formatLocalDate(new Date())] ?? null).toBeNull();
    expect(await fakeBrowser.storage.local.get()).toEqual(localBefore);
    expect(await fakeBrowser.storage.sync.get()).toEqual(syncBefore);
    expect(writes).toHaveBeenCalledOnce();

    await edit();
    expect(writes).toHaveBeenCalledTimes(2);
    expect(await readLearningDocument()).not.toEqual(document);
    expect(await fakeBrowser.storage.sync.get()).toEqual(syncBefore);
    expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('2024-01-15T10:00:00.000Z');
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
      expect(Object.values((await readLearningDocument()).cards)).toEqual([card]);
      expect(await readLearningDocument()).toEqual(document);
    }
  );

  it('preserves missing-card errors and harmless note deletion', async () => {
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    expect((await readLearningDocument()).cards.missing?.note ?? null).toBeNull();
    await dispatch('deleteNote', { slug: 'missing' });
    await dispatch('saveNote', { slug: 'missing', text: '' });
    await expect(dispatch('delayCard', { slug: 'missing', days: 1 })).rejects.toThrow('not found');
    await expect(dispatch('setPauseStatus', { slug: 'missing', paused: true })).rejects.toThrow('not found');
    expect(writes).not.toHaveBeenCalled();
    await dispatch('removeCard', { slug: 'missing' });
    expect(Object.values((await readLearningDocument()).cards)).toEqual([]);
    await dispatch('addCard', { problem: buildProblem() });
    const card = requireDefined((await readLearningDocument()).cards['two-sum']);
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
      expect(Object.values((await readLearningDocument()).cards)).toEqual([]);
      expect(await readLearningDocument()).toEqual(before);
    }
  );

  it.each([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const)(
    'preserves repeated scheduling and daily statistics for rating %s',
    async (rating) => {
      await dispatch('addCard', { problem: buildProblem() });
      const card = requireDefined((await readLearningDocument()).cards['two-sum']);
      await dispatch('saveNote', { slug: card.slug, text: '  retained\n' });
      await expect(
        dispatch('rateCard', { input: { ...buildProblem({ name: 'Changed' }), rating } })
      ).resolves.toBeUndefined();
      const first = requireDefined((await readLearningDocument()).cards[card.slug]);
      expect(first).toMatchObject({
        id: card.id,
        name: card.name,
        createdAt: card.createdAt,
        note: '  retained\n',
      });
      expect(first.fsrs.reps).toBe(1);
      expect(first.fsrs.last_review).toBe(card.createdAt);
      expect(first.fsrs.state).toBe(State.Review);
      expect(first.fsrs.scheduled_days).toBeGreaterThanOrEqual(1);
      expect(first.fsrs.due).toBeGreaterThanOrEqual(new Date('2024-03-16T12:00:00').getTime());
      vi.setSystemTime(first.fsrs.due - 1);
      expect(await getReviewQueue()).toEqual([]);
      vi.setSystemTime(first.fsrs.due);
      expect(await getReviewQueue()).toEqual([first]);
      // Another attempt on the same review day counts as a reviewed card.
      vi.setSystemTime(card.createdAt);
      await expect(dispatch('rateCard', { input: { ...buildProblem(), rating } })).resolves.toBeUndefined();
      const second = requireDefined((await readLearningDocument()).cards[card.slug]);
      expect(second.fsrs.reps).toBe(2);
      expect(second.fsrs.state).toBe(State.Review);
      expect(second.fsrs.scheduled_days).toBeGreaterThanOrEqual(1);
      expect(second.fsrs.due).toBeGreaterThanOrEqual(new Date('2024-03-16T12:00:00').getTime());
      expect(Object.values((await readLearningDocument()).cards)).toEqual([second]);
      expect((await readLearningDocument()).stats[formatLocalDate(new Date())] ?? null).toEqual({
        date: '2024-03-15',
        streak: 1,
        totalReviews: 2,
        newCards: 1,
        reviewedCards: 1,
        gradeBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, [rating]: 2 },
      });
    }
  );

  describe.each([
    ['untracked', undefined],
    ['Learning', State.Learning],
    ['Review', State.Review],
    ['Relearning', State.Relearning],
  ] as const)('long-term scheduling for %s cards', (_name, state) => {
    it.each([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const)(
      'schedules rating %s in Review state at least one day later',
      async (rating) => {
        const problem = buildProblem();
        const existing = state === undefined ? undefined : createMockCard(state, { ...problem, note: 'Retained' });
        if (existing) {
          existing.fsrs.last_review = new Date(
            state === State.Review ? '2024-03-12T12:00:00' : '2024-03-15T11:50:00'
          ).getTime();
          existing.fsrs.learning_steps = state === State.Review ? 0 : 1;
          const document = await readLearningDocument();
          await replaceLearningDocument({ ...document, cards: { [existing.slug]: existing } });
          expect((await readLearningDocument()).cards[existing.slug]).toEqual(existing);
        }

        await expect(dispatch('rateCard', { input: { ...problem, rating } })).resolves.toBeUndefined();
        const card = requireDefined((await readLearningDocument()).cards[problem.slug]);

        expect(card.fsrs).toMatchObject({
          state: State.Review,
          learning_steps: 0,
          last_review: Date.now(),
          reps: (existing?.fsrs.reps ?? 0) + 1,
        });
        expect(card.fsrs.scheduled_days).toBeGreaterThanOrEqual(1);
        expect(card.fsrs.due).toBeGreaterThanOrEqual(new Date('2024-03-16T12:00:00').getTime());
        expect((await readLearningDocument()).cards[card.slug]).toEqual(card);
        if (existing) {
          expect(card).toMatchObject({ id: existing.id, createdAt: existing.createdAt, note: 'Retained' });
        }
      }
    );
  });

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

      await dispatch('rateCard', { input: { ...buildProblem(), rating: Rating.Good } });
      const card = requireDefined((await readLearningDocument()).cards['two-sum']);
      expect(card.createdAt).toBe(now.getTime());
      expect(card.fsrs.last_review).toBe(now.getTime());
      expect((await readLearningDocument()).stats[formatLocalDate(new Date())] ?? null).toBeNull();
      expect(await readLearningDocument()).toMatchObject({
        dataUpdatedAt: now.toISOString(),
        stats: { ...document.stats, [today]: { newCards: 1, totalReviews: 1, streak: 8 } },
      });
    }
  );
});
