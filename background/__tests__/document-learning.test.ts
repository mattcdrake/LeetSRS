import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { onMessage } from '@/shared/messages';
import { learningDocumentSchema } from '@/shared/models';
import { readLearningDocument, replaceLearningDocument, STORAGE_KEYS } from '@/shared/storage';
import { requireDefined } from '@/test/utils/assertions';
import { dispatchBackgroundCommand as dispatch } from '@/test/utils/background-messages';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import { getReviewQueue } from '@/test/utils/learning-reads';
import background from '../../entrypoints/background/index';

vi.mock('@/shared/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/messages')>()),
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
    await replaceLearningDocument(buildLearningDocument({ settings: { language: 'en' } }));
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
    expect((await readLearningDocument()).reviewActivity).toBeNull();
    expect(await readLearningDocument()).toEqual(before);
    release.resolve();
    await expect(pending).resolves.toBeUndefined();
    const card = requireDefined((await readLearningDocument()).cards['1']);

    expect(card).toMatchObject({ ...buildProblem(), createdAt: Date.now(), paused: false });
    expect(card.fsrs).toMatchObject({
      due: new Date('2024-03-18T12:00:00').getTime(),
      last_review: Date.now(),
      reps: 1,
      state: State.Review,
    });
    expect(Object.values((await readLearningDocument()).cards)).toEqual([card]);
    const stats = (await readLearningDocument()).reviewActivity;
    expect(stats).toEqual({
      newCards: 1,
      streak: 1,
      date: '2024-03-15',
    });
    expect(await readLearningDocument()).toEqual({
      ...before,
      cards: { [card.frontendId]: card },
      reviewActivity: stats,
      dataUpdatedAt: new Date().toISOString(),
    });
    expect(writes).toHaveBeenCalledExactlyOnceWith({
      [STORAGE_KEYS.learningDocument.slice('local:'.length)]: await readLearningDocument(),
    });
  });

  it('preserves card identity and unrelated data through card and note edits', async () => {
    const original = buildLearningDocument({
      cards: { '1': createMockCard(State.Review, { frontendId: '1', paused: true, note: 'Keep this note' }) },
      reviewActivity: { date: '2024-01-01', newCards: 0, streak: 1 },
      settings: { theme: 'dark' },
      dataUpdatedAt: '2024-01-15T10:00:00.000Z',
    });
    await replaceLearningDocument(original);
    const others = Object.values(original.cards);
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    const problem = buildProblem({ frontendId: 'new-problem' });
    await expect(dispatch('addCard', { problem })).resolves.toBeUndefined();
    const card = requireDefined((await readLearningDocument()).cards[problem.frontendId]);
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
    await expect(dispatch('addCard', { problem: { ...problem, domain: 'leetcode.cn' } })).resolves.toBeUndefined();
    expect(writes).toHaveBeenCalledTimes(1);
    await dispatch('saveNote', { frontendId: card.frontendId, text: '  solution\n\t' });
    expect((await readLearningDocument()).cards[card.frontendId]?.note ?? null).toBe('  solution\n\t');
    await expect(dispatch('setPauseStatus', { frontendId: card.frontendId, paused: true })).resolves.toBeUndefined();
    const paused = requireDefined((await readLearningDocument()).cards[card.frontendId]);
    expect(paused).toEqual({ ...card, paused: true, note: '  solution\n\t' });
    vi.setSystemTime(new Date('2024-03-16T12:00:00'));
    await expect(dispatch('delayCard', { frontendId: card.frontendId, days: 2 })).resolves.toBeUndefined();
    const delayed = requireDefined((await readLearningDocument()).cards[card.frontendId]);
    expect(delayed).toEqual({ ...paused, fsrs: { ...paused.fsrs, due: new Date('2024-03-17T12:00:00').getTime() } });
    await expect(dispatch('setPauseStatus', { frontendId: card.frontendId, paused: false })).resolves.toBeUndefined();
    expect((await readLearningDocument()).cards[card.frontendId]).toEqual({ ...delayed, paused: false });
    await dispatch('saveNote', { frontendId: card.frontendId, text: 'a'.repeat(500) });
    await expect(dispatch('saveNote', { frontendId: card.frontendId, text: 'a'.repeat(501) })).rejects.toThrow(
      'maximum length'
    );
    expect((await readLearningDocument()).cards[card.frontendId]?.note ?? null).toBe('a'.repeat(500));
    await dispatch('saveNote', { frontendId: card.frontendId, text: '' });
    expect((await readLearningDocument()).cards[card.frontendId]?.note ?? null).toBeNull();
    await dispatch('saveNote', { frontendId: card.frontendId, text: 'removed with card' });
    await dispatch('removeCard', { frontendId: card.frontendId });
    expect(Object.values((await readLearningDocument()).cards)).toEqual(others);
    expect((await readLearningDocument()).cards[card.frontendId]?.note ?? null).toBeNull();
    expect(await readLearningDocument()).toEqual({ ...original, dataUpdatedAt: new Date().toISOString() });
    expect(writes).toHaveBeenCalledTimes(9);
    for (const [index, [items]] of writes.mock.calls.entries()) {
      expect(Object.keys(items)).toEqual([STORAGE_KEYS.learningDocument.slice('local:'.length)]);
      const document = learningDocumentSchema.parse(
        Reflect.get(items, STORAGE_KEYS.learningDocument.slice('local:'.length))
      );
      expect(document).toMatchObject({
        cards: original.cards,
        reviewActivity: original.reviewActivity,
        settings: original.settings,
      });
      expect(document.dataUpdatedAt).toBe(
        new Date(index < 3 ? '2024-03-15T12:00:00' : '2024-03-16T12:00:00').toISOString()
      );
    }
  });

  it('keeps a review schedule, activity, and edit timestamp on the captured day when a read crosses midnight', async () => {
    const now = new Date('2024-03-15T23:59:59.999');
    vi.setSystemTime(now);
    const get = storage.getItem.bind(storage);
    vi.spyOn(storage, 'getItem').mockImplementationOnce(async (key) => {
      const document = await get(key);
      vi.setSystemTime(new Date('2024-03-16T00:00:00'));
      return document;
    });

    await dispatch('rateCard', { input: { ...buildProblem(), rating: Rating.Good } });
    const card = requireDefined((await readLearningDocument()).cards['1']);

    expect(card.createdAt).toBe(now.getTime());
    expect(card.fsrs.last_review).toBe(now.getTime());
    expect(card.fsrs.due).toBe(new Date('2024-03-18T23:59:59.999').getTime());
    expect(await readLearningDocument()).toMatchObject({
      cards: { [card.frontendId]: card },
      reviewActivity: { date: '2024-03-15', newCards: 1 },
      dataUpdatedAt: now.toISOString(),
    });
    expect((await readLearningDocument()).reviewActivity?.date).toBe('2024-03-15');
  });

  it('uses one document and time for queue eligibility and the daily allowance across midnight', async () => {
    vi.setSystemTime(new Date('2024-03-14T23:59:59.999'));
    const cards = ['new-a', 'new-b', 'future', 'review', 'paused'].map((slug) => {
      const card = createMockCard(slug === 'review' ? State.Review : State.New, {
        frontendId: slug,
        paused: slug === 'paused',
      });
      if (slug === 'future') {
        card.fsrs.due = new Date('2024-03-15T00:00:00').getTime();
      }
      return card;
    });
    const document = buildLearningDocument({
      cards: Object.fromEntries(cards.map((card) => [card.frontendId, card])),
      reviewActivity: { date: '2024-03-14', newCards: 1, streak: 1 },
      settings: { maxNewCardsPerDay: 2 },
    });
    await replaceLearningDocument(document);
    const get = storage.getItem.bind(storage);
    vi.spyOn(storage, 'getItem').mockImplementationOnce(async (key) => {
      const result = await get(key);
      vi.setSystemTime(new Date('2024-03-15T00:00:00'));
      await replaceLearningDocument({ ...document, settings: { maxNewCardsPerDay: 3 } });
      return result;
    });

    expect((await getReviewQueue()).map((card) => card.frontendId)).toEqual(['new-a', 'review']);
    expect((await getReviewQueue()).map((card) => card.frontendId)).toEqual(['new-a', 'new-b', 'review', 'future']);
    await replaceLearningDocument({ ...document, settings: { maxNewCardsPerDay: 0 } });
    expect((await getReviewQueue()).map((card) => card.frontendId)).toEqual(['review']);
    await replaceLearningDocument({ ...document, settings: {} });
    expect((await getReviewQueue()).map((card) => card.frontendId)).toEqual(['new-a', 'new-b', 'review', 'future']);
  });

  it.each([
    ['rate existing', () => dispatch('rateCard', { input: { ...buildProblem(), rating: Rating.Again } })],
    ['save note', () => dispatch('saveNote', { frontendId: '1', text: '  new note\n' })],
  ])('leaves all saved data intact when %s is rejected and accepts the next command', async (_name, edit) => {
    const document = buildLearningDocument({
      cards: { '1': createMockCard(State.Review, { frontendId: '1', paused: true, note: 'Keep this note' }) },
      reviewActivity: { date: '2024-01-01', newCards: 0, streak: 1 },
      settings: { language: 'en' },
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
    expect((await readLearningDocument()).cards['1']?.note ?? null).toBe('Keep this note');
    expect((await readLearningDocument()).reviewActivity).toEqual(document.reviewActivity);
    expect(await fakeBrowser.storage.local.get()).toEqual(localBefore);
    expect(await fakeBrowser.storage.sync.get()).toEqual(syncBefore);
    expect(writes).toHaveBeenCalledOnce();

    await edit();
    expect(writes).toHaveBeenCalledTimes(2);
    expect(await readLearningDocument()).not.toEqual(document);
    expect(await fakeBrowser.storage.sync.get()).toEqual(syncBefore);
    expect(await storage.getItem(STORAGE_KEYS.lastSyncTime)).toBe('2024-01-15T10:00:00.000Z');
  });

  it.each(['delay overflow', 'allowance overflow', 'invalid clock'])(
    'rejects %s before any write and preserves the previous document',
    async (failure) => {
      const card = createMockCard(State.New, buildProblem());
      const document = buildLearningDocument({
        cards: { [card.frontendId]: card },
        settings: { language: 'en' },
        reviewActivity: { date: '2024-03-15', newCards: Number.MAX_SAFE_INTEGER, streak: 1 },
      });
      await replaceLearningDocument(document);
      const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
      if (failure === 'invalid clock') {
        vi.setSystemTime(Number.NaN);
      }
      const edit =
        failure === 'delay overflow'
          ? dispatch('delayCard', { frontendId: card.frontendId, days: Number.MAX_SAFE_INTEGER })
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
    await dispatch('saveNote', { frontendId: 'missing', text: '' });
    await expect(dispatch('delayCard', { frontendId: 'missing', days: 1 })).rejects.toThrow('not found');
    await expect(dispatch('setPauseStatus', { frontendId: 'missing', paused: true })).rejects.toThrow('not found');
    expect(writes).not.toHaveBeenCalled();
    await dispatch('removeCard', { frontendId: 'missing' });
    expect(Object.values((await readLearningDocument()).cards)).toEqual([]);
    await dispatch('addCard', { problem: buildProblem() });
    const card = requireDefined((await readLearningDocument()).cards['1']);
    writes.mockClear();
    await dispatch('saveNote', { frontendId: card.frontendId, text: '' });
    expect(writes).not.toHaveBeenCalled();
  });

  it.each([Rating.Again, Rating.Good] as const)(
    'preserves repeated scheduling and daily activity for rating %s',
    async (rating) => {
      await dispatch('addCard', { problem: buildProblem() });
      const card = requireDefined((await readLearningDocument()).cards['1']);
      await dispatch('saveNote', { frontendId: card.frontendId, text: '  retained\n' });
      await expect(
        dispatch('rateCard', { input: { ...buildProblem({ domain: 'leetcode.cn' }), rating } })
      ).resolves.toBeUndefined();
      const first = requireDefined((await readLearningDocument()).cards[card.frontendId]);
      expect(first).toMatchObject({
        frontendId: card.frontendId,
        domain: card.domain,
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
      const second = requireDefined((await readLearningDocument()).cards[card.frontendId]);
      expect(second.fsrs.reps).toBe(2);
      expect(second.fsrs.state).toBe(State.Review);
      expect(second.fsrs.scheduled_days).toBeGreaterThanOrEqual(1);
      expect(second.fsrs.due).toBeGreaterThanOrEqual(new Date('2024-03-16T12:00:00').getTime());
      expect(Object.values((await readLearningDocument()).cards)).toEqual([second]);
      expect((await readLearningDocument()).reviewActivity).toEqual({
        streak: 1,
        newCards: 1,
        date: '2024-03-15',
      });
    }
  );

  describe.each([
    ['untracked', undefined],
    ['Learning', State.Learning],
    ['Review', State.Review],
    ['Relearning', State.Relearning],
  ] as const)('long-term scheduling for %s cards', (_name, state) => {
    it.each([Rating.Again, Rating.Good] as const)(
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
          await replaceLearningDocument({ ...document, cards: { [existing.frontendId]: existing } });
          expect((await readLearningDocument()).cards[existing.frontendId]).toEqual(existing);
        }

        await expect(dispatch('rateCard', { input: { ...problem, rating } })).resolves.toBeUndefined();
        const card = requireDefined((await readLearningDocument()).cards[problem.frontendId]);

        expect(card.fsrs).toMatchObject({
          state: State.Review,
          learning_steps: 0,
          last_review: Date.now(),
          reps: (existing?.fsrs.reps ?? 0) + 1,
        });
        expect(card.fsrs.scheduled_days).toBeGreaterThanOrEqual(1);
        expect(card.fsrs.due).toBeGreaterThanOrEqual(new Date('2024-03-16T12:00:00').getTime());
        expect((await readLearningDocument()).cards[card.frontendId]).toEqual(card);
        if (existing) {
          expect(card).toMatchObject({
            frontendId: existing.frontendId,
            createdAt: existing.createdAt,
            note: 'Retained',
          });
        }
      }
    );
  });
});
