import { readFileSync } from 'node:fs';
import { State } from 'ts-fsrs';
import { expect, it } from 'vitest';
import { ROADMAP_IDS, roadmapSchema, summarizeRoadmap } from '@/shared/roadmap';
import { createMockCard } from '@/test/utils/card-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';

it.each(ROADMAP_IDS)('%s matches the roadmap schema', (id) => {
  const data = JSON.parse(readFileSync(`public/data/roadmaps/${id}.json`, 'utf8'));
  expect(() => roadmapSchema.parse(data)).not.toThrow();
});

it('counts each roadmap problem in one progress segment', () => {
  const reviewed = createMockCard(State.Review, { frontendId: '1' });
  const saved = createMockCard(State.New, { frontendId: '2', fsrs: { ...reviewed.fsrs, reps: 0 } });
  const skippedAndSaved = createMockCard(State.New, { frontendId: '3', fsrs: { ...reviewed.fsrs, reps: 0 } });
  const document = buildLearningDocument({
    cards: { 1: reviewed, 2: saved, 3: skippedAndSaved, 99: createMockCard(State.Review, { frontendId: '99' }) },
  });

  // Skips outside the roadmap and cards outside it are ignored.
  expect(summarizeRoadmap(document, ['1', '2', '3', '4', '5'], ['3', '4', '100'])).toEqual({
    total: 5,
    reviewed: 1,
    new: 2,
    skipped: 1,
  });
});
