import { registerService } from '@webext-core/proxy-service';
import { Rating, State } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { learningDocumentItem, readLearningDocument, replaceLearningDocument } from '@/shared/learning-document';
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

  it('publishes a complete review only after the document replacement succeeds', async () => {
    const preview = await getRegisteredBackground().previewRatings(buildProblem());
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
      scheduled_days: preview[Rating.Good],
    });
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
      [learningDocumentItem.key.slice('local:'.length)]: await readLearningDocument(),
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
    const get = learningDocumentItem.getValue.bind(learningDocumentItem);
    vi.spyOn(learningDocumentItem, 'getValue').mockImplementationOnce(async () => {
      const document = await get();
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
  });

  it('undoes the latest panel save only while its card and review activity are unchanged', async () => {
    const service = getRegisteredBackground();
    const existing = createMockCard(State.Review, buildProblem());
    const before = { ...(await readLearningDocument()), cards: { '1': existing } };
    before.reviewActivity = { date: '2024-03-14', newCards: 1, streak: 4 };
    await replaceLearningDocument(before);
    const first = requireDefined((await service.saveProblem({ ...buildProblem(), rating: Rating.Good })).undoToken);
    await service.undoSave(first);
    expect(await readLearningDocument()).toEqual({ ...before, dataUpdatedAt: new Date().toISOString() });
    await expect(service.undoSave(first)).rejects.toThrow();

    const added = await service.saveProblem(buildProblem({ frontendId: '2' }));
    expect(added.card.fsrs.reps).toBe(0);
    await service.rateCard({ ...buildProblem({ frontendId: '3' }), rating: Rating.Good });
    const activity = (await readLearningDocument()).reviewActivity;
    await service.undoSave(requireDefined(added.undoToken));
    expect(await readLearningDocument()).toMatchObject({ cards: { '1': existing }, reviewActivity: activity });
    expect((await readLearningDocument()).cards['2']).toBeUndefined();

    const rated = await service.saveProblem({ ...buildProblem(), rating: Rating.Easy });
    await service.saveNote('1', 'Edited after saving');
    await expect(service.undoSave(requireDefined(rated.undoToken))).rejects.toThrow('changed');
    expect((await readLearningDocument()).cards['1']).toEqual({ ...rated.card, note: 'Edited after saving' });

    const reviewed = await service.saveProblem({ ...buildProblem({ frontendId: '4' }), rating: Rating.Good });
    await service.rateCard({ ...buildProblem({ frontendId: '5' }), rating: Rating.Good });
    await expect(service.undoSave(requireDefined(reviewed.undoToken))).rejects.toThrow('changed');
    expect((await readLearningDocument()).cards['4']).toEqual(reviewed.card);
  });

  it('reports a committed panel save as saved when its undo cannot be recorded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(fakeBrowser.storage.session, 'set').mockRejectedValueOnce(new Error('Quota exceeded'));
    const saved = await getRegisteredBackground().saveProblem({ ...buildProblem(), rating: Rating.Good });
    expect(saved.undoToken).toBeNull();
    expect((await readLearningDocument()).cards['1']).toEqual(saved.card);
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
    }

    const preview = await getRegisteredBackground().previewRatings(problem);
    await getRegisteredBackground().rateCard({ ...problem, domain: 'leetcode.cn', rating });
    const saved = await readLearningDocument();
    const card = requireDefined(saved.cards[problem.frontendId]);

    expect(card.fsrs).toMatchObject({
      state: State.Review,
      learning_steps: 0,
      last_review: Date.now(),
      reps: (existing?.fsrs.reps ?? 0) + 1,
    });
    expect(card.fsrs.scheduled_days).toBe(preview[rating]);
    expect(card.fsrs.scheduled_days).toBeGreaterThanOrEqual(1);
    expect(card.fsrs.due).toBeGreaterThanOrEqual(new Date('2024-03-16T12:00:00').getTime());
    expect(saved.reviewActivity?.newCards).toBe(existing ? 0 : 1);
    if (existing) {
      expect(card).toMatchObject({
        frontendId: existing.frontendId,
        domain: existing.domain,
        createdAt: existing.createdAt,
        note: 'Retained',
      });
    }
  });
});
