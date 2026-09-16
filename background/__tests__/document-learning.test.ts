import { registerService } from '@webext-core/proxy-service';
import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { readLearningDocument, replaceLearningDocument, STORAGE_KEYS } from '@/shared/storage';
import { requireDefined } from '@/test/utils/assertions';
import { getRegisteredBackground } from '@/test/utils/background-service';
import { buildProblem, createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';
import backgroundEntry from '../../entrypoints/background/index';

vi.mock('@webext-core/proxy-service', () => import('@/test/mocks/proxy-service'));

describe('document learning through background commands', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    fakeBrowser.runtime.id = 'test';
    vi.mocked(registerService).mockClear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2024-03-15T12:00:00'));
    await replaceLearningDocument(buildLearningDocument({ settings: { language: 'en' } }));
    backgroundEntry.main();
    await getRegisteredBackground().waitForInitialization();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('previews the actual schedule for new and existing cards', async () => {
    const service = getRegisteredBackground();
    for (const reps of [1, 2]) {
      const preview = await service.previewRatings(buildProblem());
      const ratedCard = await service.rateCard({ ...buildProblem(), rating: Rating.Good });
      const card = requireDefined((await readLearningDocument()).cards['1']);
      expect(ratedCard).toEqual(card);
      expect(card.fsrs.scheduled_days).toBe(preview[Rating.Good]);
      expect(card.fsrs.reps).toBe(reps);
    }
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
    const pending = getRegisteredBackground().rateCard({ ...buildProblem(), rating: Rating.Good });
    void pending.then(settled);
    await started.promise;

    expect(settled).not.toHaveBeenCalled();
    expect(Object.values((await readLearningDocument()).cards)).toEqual([]);
    expect((await readLearningDocument()).reviewActivity).toBeNull();
    expect(await readLearningDocument()).toEqual(before);
    release.resolve();
    const card = await pending;
    expect(card).toEqual((await readLearningDocument()).cards['1']);

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
    const problem = buildProblem({ frontendId: 'new-problem' });
    await expect(getRegisteredBackground().addCard(problem)).resolves.toBeUndefined();
    const card = requireDefined((await readLearningDocument()).cards[problem.frontendId]);
    expect(Object.values((await readLearningDocument()).cards)).toEqual([...others, card]);
    expect(card.fsrs).toMatchObject({ due: Date.now(), reps: 0, state: State.New });
    await expect(getRegisteredBackground().addCard({ ...problem, domain: 'leetcode.cn' })).resolves.toBeUndefined();
    expect((await readLearningDocument()).cards[problem.frontendId]).toEqual(card);
    await getRegisteredBackground().saveNote(card.frontendId, '  solution\n\t');
    expect((await readLearningDocument()).cards[card.frontendId]?.note ?? null).toBe('  solution\n\t');
    await expect(getRegisteredBackground().setPauseStatus(card.frontendId, true)).resolves.toBeUndefined();
    const paused = requireDefined((await readLearningDocument()).cards[card.frontendId]);
    expect(paused).toEqual({ ...card, paused: true, note: '  solution\n\t' });
    vi.setSystemTime(new Date('2024-03-16T12:00:00'));
    await expect(getRegisteredBackground().delayCard(card.frontendId, 2)).resolves.toBeUndefined();
    const delayed = requireDefined((await readLearningDocument()).cards[card.frontendId]);
    expect(delayed).toEqual({ ...paused, fsrs: { ...paused.fsrs, due: new Date('2024-03-17T12:00:00').getTime() } });
    await expect(getRegisteredBackground().setPauseStatus(card.frontendId, false)).resolves.toBeUndefined();
    expect((await readLearningDocument()).cards[card.frontendId]).toEqual({ ...delayed, paused: false });
    await getRegisteredBackground().saveNote(card.frontendId, 'a'.repeat(500));
    await expect(getRegisteredBackground().saveNote(card.frontendId, 'a'.repeat(501))).rejects.toThrow(
      'maximum length'
    );
    expect((await readLearningDocument()).cards[card.frontendId]?.note ?? null).toBe('a'.repeat(500));
    await getRegisteredBackground().saveNote(card.frontendId, '');
    expect((await readLearningDocument()).cards[card.frontendId]?.note ?? null).toBeNull();
    await getRegisteredBackground().saveNote(card.frontendId, 'removed with card');
    await getRegisteredBackground().removeCard(card.frontendId);
    expect(Object.values((await readLearningDocument()).cards)).toEqual(others);
    expect((await readLearningDocument()).cards[card.frontendId]?.note ?? null).toBeNull();
    expect(await readLearningDocument()).toEqual({ ...original, dataUpdatedAt: new Date().toISOString() });
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

    await getRegisteredBackground().rateCard({ ...buildProblem(), rating: Rating.Good });
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

  it('preserves missing-card errors and harmless note deletion', async () => {
    const writes = vi.spyOn(fakeBrowser.storage.local, 'set');
    expect((await readLearningDocument()).cards.missing?.note ?? null).toBeNull();
    await getRegisteredBackground().saveNote('missing', '');
    await expect(getRegisteredBackground().delayCard('missing', 1)).rejects.toThrow('not found');
    await expect(getRegisteredBackground().setPauseStatus('missing', true)).rejects.toThrow('not found');
    expect(writes).not.toHaveBeenCalled();
    await getRegisteredBackground().removeCard('missing');
    expect(Object.values((await readLearningDocument()).cards)).toEqual([]);
    await getRegisteredBackground().addCard(buildProblem());
    const card = requireDefined((await readLearningDocument()).cards['1']);
    writes.mockClear();
    await getRegisteredBackground().saveNote(card.frontendId, '');
    expect(writes).not.toHaveBeenCalled();
  });

  it('preserves repeated scheduling and daily activity', async () => {
    await getRegisteredBackground().addCard(buildProblem());
    const card = requireDefined((await readLearningDocument()).cards['1']);
    await getRegisteredBackground().saveNote(card.frontendId, '  retained\n');
    await getRegisteredBackground().rateCard({ ...buildProblem({ domain: 'leetcode.cn' }), rating: Rating.Good });
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
    // Another attempt on the same review day counts as a reviewed card.
    await getRegisteredBackground().rateCard({ ...buildProblem(), rating: Rating.Good });
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
  });

  it.each([
    ['untracked', undefined, Rating.Again],
    ['Learning', State.Learning, Rating.Good],
    ['Review', State.Review, Rating.Again],
    ['Relearning', State.Relearning, Rating.Good],
  ] as const)('schedules %s cards in Review state at least one day later', async (_name, state, rating) => {
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

    await getRegisteredBackground().rateCard({ ...problem, rating });
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
  });
});
