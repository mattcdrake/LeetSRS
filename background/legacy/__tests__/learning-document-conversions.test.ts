import { State } from 'ts-fsrs';
import { expect, it } from 'vitest';
import {
  convertLearningDocument,
  parseLearningDocumentBackup,
} from '@/background/legacy/learning-document-conversions';
import { LEARNING_DOCUMENT_VERSION } from '@/shared/learning-document';
import { createMockCard } from '@/test/utils/card-mocks';

// When adding a schema version, extend the unversioned input with the data the new
// conversion reads and the expected document with what it produces.
it('converts an unversioned document through every schema version', () => {
  const { frontendId: _frontendId, domain: _domain, ...learning } = createMockCard(State.Review);
  const legacyCard = { ...learning, slug: 'two-sum', name: 'Two Sum', difficulty: 'Easy' };
  const dataUpdatedAt = '2024-01-15T10:00:00.000Z';
  const data = {
    cards: {
      // v1: missing domains default to leetcode.com.
      // v4: separate notes attach to cards without an embedded note.
      'two-sum': { ...legacyCard, id: 'a', leetcodeId: '1' },
      // v4: an embedded note, even an empty one, takes precedence over a separate note.
      'cn-problem': { ...legacyCard, id: 'b', leetcodeId: '2', domain: 'leetcode.cn', note: '' },
      // v4: a card with an invalid separate note is discarded.
      'bad-note': { ...legacyCard, id: 'c', leetcodeId: '3' },
      // v10: cards are rekeyed by frontend ID; invalid cards are discarded.
      'no-id': { ...legacyCard, id: 'd', leetcodeId: '' },
      broken: { ...legacyCard, id: 'e', leetcodeId: '4', fsrs: null },
      missing: null,
    },
    notes: { a: { text: 'Keep this note' }, b: { text: 'Shadowed' }, c: { text: 42 } },
    // v9: only the latest day's allowance and streak are retained.
    stats: {
      '2024-01-15': { newCards: 3, streak: 9, totalReviews: 4, gradeBreakdown: { 1: 0, 2: 0, 3: 4, 4: 0 } },
      '2024-01-14': { newCards: 2, streak: 8, totalReviews: 3, gradeBreakdown: { 1: 1, 2: 0, 3: 2, 4: 0 } },
    },
    settings: {
      theme: 'dark',
      // v3: autoClearLeetcode becomes resetEditorOnEveryProblem.
      // v7: either legacy reset preference becomes resetEditorOnReviewQueue.
      autoClearLeetcode: true,
      resetEditorOnDueReview: false,
      dayStartHour: 4,
      // v11: removed languages fall back to English.
      language: 'de',
    },
    gistSync: null,
  };

  const expected = {
    schemaVersion: LEARNING_DOCUMENT_VERSION,
    cards: {
      '1': { ...learning, frontendId: '1', domain: 'leetcode.com', note: 'Keep this note' },
      '2': { ...learning, frontendId: '2', domain: 'leetcode.cn' },
    },
    reviewActivity: { date: '2024-01-15', newCards: 3, streak: 9 },
    settings: { theme: 'dark', language: 'en', resetEditorOnReviewQueue: true },
    // v12: roadmap state starts empty.
    activeRoadmapId: null,
    roadmapSkips: {},
    dataUpdatedAt,
  };
  expect(convertLearningDocument({ ...structuredClone(data), dataUpdatedAt })).toEqual(expected);
  expect(parseLearningDocumentBackup(JSON.stringify({ exportDate: dataUpdatedAt, data }))).toEqual(expected);
  expect(convertLearningDocument(expected)).toEqual(expected);
});
