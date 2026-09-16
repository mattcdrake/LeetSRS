import { describe, expect, it } from 'vitest';
import {
  convertLearningDocument,
  parseLearningDocumentBackup,
} from '@/background/legacy/learning-document-conversions';
import { cardSchema, LEARNING_DOCUMENT_VERSION } from '@/shared/models';
import { validLegacyBackup } from '@/test/utils/backup-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';

describe('convertLearningDocument', () => {
  it('rekeys v9 cards by frontend ID, retaining learning data and discarding invalid cards and metadata', () => {
    const { backup } = validLegacyBackup();
    const original = { ...backup.data.cards['two-sum'], domain: 'leetcode.cn', note: 'Keep my approach' };
    const input = {
      schemaVersion: 9,
      dataUpdatedAt: backup.dataUpdatedAt,
      cards: {
        'two-sum': original,
        invalid: { ...original, leetcodeId: '' },
        broken: { ...original, leetcodeId: '2', fsrs: null },
        invalidNote: { ...original, leetcodeId: '3', note: 42 },
        missing: null,
      },
      reviewActivity: { date: '2024-01-01', newCards: 2, streak: 3 },
      settings: { theme: 'dark' },
    };
    const expected = {
      ...input,
      schemaVersion: LEARNING_DOCUMENT_VERSION,
      cards: {
        '1': {
          frontendId: '1',
          domain: 'leetcode.cn',
          createdAt: original.createdAt,
          fsrs: original.fsrs,
          paused: original.paused,
          note: original.note,
        },
      },
    };
    expect(convertLearningDocument(input)).toEqual(expected);
    expect(parseLearningDocumentBackup(JSON.stringify(input))).toEqual(expected);
  });

  it('retires historical statistics while retaining the latest allowance and streak', () => {
    const input = {
      schemaVersion: 8,
      dataUpdatedAt: '2024-03-15T12:00:00.000Z',
      cards: {},
      settings: {},
      stats: {
        '2024-03-15': { newCards: 3, streak: 9, gradeBreakdown: { 1: 0, 2: 0, 3: 4, 4: 0 } },
        '2024-03-14': { newCards: 2, streak: 8, gradeBreakdown: { 1: 1, 2: 0, 3: 3, 4: 0 } },
      },
    };
    const expected = {
      schemaVersion: LEARNING_DOCUMENT_VERSION,
      dataUpdatedAt: input.dataUpdatedAt,
      cards: {},
      settings: {},
      reviewActivity: { date: '2024-03-15', newCards: 3, streak: 9 },
    };
    expect(convertLearningDocument(input)).toEqual(expected);
    expect(parseLearningDocumentBackup(JSON.stringify(input))).toEqual(expected);
  });

  it.each([
    [{ resetEditorOnReviewQueue: false, resetEditorOnEveryProblem: true, resetEditorOnDueReview: true }, false],
    [{ resetEditorOnReviewQueue: true, resetEditorOnEveryProblem: false, resetEditorOnDueReview: false }, true],
    [{ resetEditorOnEveryProblem: true, resetEditorOnDueReview: false }, true],
    [{ resetEditorOnEveryProblem: false, resetEditorOnDueReview: true }, true],
    [{ resetEditorOnEveryProblem: false, resetEditorOnDueReview: false }, false],
    [{}, false],
  ] as const)('converts legacy editor-reset settings %j to the queue-opening preference', (settings, expected) => {
    expect(
      convertLearningDocument({
        schemaVersion: 6,
        cards: {},
        stats: {},
        settings,
      })
    ).toEqual(buildLearningDocument({ settings: { resetEditorOnReviewQueue: expected } }));
  });

  it.each([undefined, '', ' \t\n '])('preserves embedded-note precedence for %j', (note) => {
    const { backup } = validLegacyBackup();
    const card = backup.data.cards['two-sum'];
    expect(
      convertLearningDocument({
        schemaVersion: 2,
        cards: { 'two-sum': { ...card, ...(note !== undefined && { note }) } },
        notes: { [card.id]: { text: 'Legacy note' }, orphan: { text: 42 } },
        settings: { resetEditorOnEveryProblem: false, autoClearLeetcode: 'ignored', dayStartHour: null },
      })
    ).toEqual(
      buildLearningDocument({
        cards: {
          '1': cardSchema.parse({
            ...card,
            frontendId: '1',
            ...(note === undefined ? { note: 'Legacy note' } : note ? { note } : {}),
          }),
        },
        settings: { resetEditorOnReviewQueue: false },
      })
    );
  });

  it.each([
    [2, true],
    [3, false],
  ])('only uses autoClearLeetcode before v3 (version %i)', (schemaVersion, resetEditorOnReviewQueue) => {
    expect(convertLearningDocument({ schemaVersion, settings: { autoClearLeetcode: true, dayStartHour: 4 } })).toEqual(
      buildLearningDocument({ settings: { resetEditorOnReviewQueue } })
    );
  });

  it.each([
    [3, 'Legacy note'],
    [4, undefined],
  ])('only attaches separate notes before v4 (version %i)', (schemaVersion, note) => {
    const { backup } = validLegacyBackup();
    const card = backup.data.cards['two-sum'];
    const document = convertLearningDocument({
      schemaVersion,
      cards: { 'two-sum': card },
      notes: { [card.id]: { text: 'Legacy note' } },
    });
    expect(document.cards['1']).toEqual(
      cardSchema.parse({ ...card, frontendId: '1', ...(note !== undefined && { note }) })
    );
  });

  it.each([
    [6, true],
    [7, undefined],
  ])('only derives queue reset from old preferences before v7 (version %i)', (schemaVersion, reset) => {
    const document = convertLearningDocument({
      schemaVersion,
      cards: {},
      stats: {},
      settings: { resetEditorOnEveryProblem: true },
    });
    expect(document.settings).toEqual(reset === undefined ? {} : { resetEditorOnReviewQueue: reset });
  });
});

describe('parseLearningDocumentBackup', () => {
  const validBackup = { schemaVersion: 2, exportDate: '2024-01-01', data: { cards: {}, stats: {} } };

  it('ignores shadowed notes, export dates, and backup Gist metadata', () => {
    const { backup } = validLegacyBackup();
    const card = { ...backup.data.cards['two-sum'], note: 'Embedded' };
    const document = parseLearningDocumentBackup(
      JSON.stringify({
        ...validBackup,
        dataUpdatedAt: '2024-01-02',
        exportDate: null,
        data: {
          cards: { 'two-sum': card },
          stats: {},
          notes: { [card.id]: { text: 42 } },
          gistSync: null,
        },
      })
    );
    expect(document).toEqual(
      buildLearningDocument({
        cards: { '1': cardSchema.parse({ ...card, frontendId: '1' }) },
        settings: { resetEditorOnReviewQueue: false },
        dataUpdatedAt: '2024-01-02',
      })
    );
  });
});
