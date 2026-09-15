import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  convertLearningDocument,
  parseLearningDocumentBackup,
} from '@/background/legacy/learning-document-conversions';
import { cardSchema, LEARNING_DOCUMENT_VERSION } from '@/shared/models';
import { validLegacyBackup } from '@/test/utils/backup-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';

const FIRST_FLAT_DOCUMENT_VERSION = 6;

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
        missing: null,
      },
      reviewActivity: { date: '2024-01-01', newCards: 2, streak: 3 },
      settings: { theme: 'dark' },
    };
    const expected = {
      ...input,
      schemaVersion: 10,
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

  it('uses the statistics date key and discards redundant fields while preserving meaningful counts', () => {
    expect(
      convertLearningDocument({
        schemaVersion: 7,
        cards: {},
        stats: {
          '2024-01-01': {
            date: '2023-12-31',
            totalReviews: 10,
            newCards: 3,
            reviewedCards: 7,
            streak: 9,
            gradeBreakdown: { 1: 1, 2: 2, 3: 3, 4: 4 },
          },
        },
        settings: {},
      })
    ).toEqual(
      buildLearningDocument({
        reviewActivity: { date: '2024-01-01', newCards: 3, streak: 9 },
      })
    );
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

  it('prepares an unversioned installation without inventing settings or an edit timestamp', () => {
    const { backup, converted } = validLegacyBackup();
    const { domain: _domain, ...legacyCard } = backup.data.cards['two-sum'];
    expect(
      convertLearningDocument({
        ...backup.data,
        cards: { ...backup.data.cards, 'two-sum': legacyCard },
        settings: { autoClearLeetcode: false, dayStartHour: 4, githubPat: 'secret' },
        gistSync: { gistId: 'old-gist', enabled: true },
        lastSyncTime: '2024-01-01',
      })
    ).toEqual(
      buildLearningDocument({
        ...converted,
        settings: { resetEditorOnReviewQueue: false },
      })
    );
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])(
    'preserves the same learning data from installations and backups at version %i without I/O or a clock',
    (schemaVersion) => {
      const { backup, converted, legacyConverted } = validLegacyBackup();
      const { domain: _domain, ...legacyCard } = backup.data.cards['two-sum'];
      const data = {
        ...(schemaVersion < 4 ? backup.data : schemaVersion < LEARNING_DOCUMENT_VERSION ? legacyConverted : converted),
        ...(schemaVersion === 0 && { cards: { ...backup.data.cards, 'two-sum': legacyCard } }),
        settings: {
          theme: 'light',
          language: 'zh-CN',
          maxNewCardsPerDay: 7,
          badgeEnabled: false,
          ...(schemaVersion < 3
            ? { autoClearLeetcode: true, dayStartHour: 4 }
            : schemaVersion < 7
              ? { resetEditorOnEveryProblem: true, resetEditorOnDueReview: false }
              : { resetEditorOnReviewQueue: true }),
        } as const,
      };
      const installation = { ...data, schemaVersion, dataUpdatedAt: backup.dataUpdatedAt };
      const before = structuredClone(installation);
      const json = JSON.stringify(
        schemaVersion >= FIRST_FLAT_DOCUMENT_VERSION ? installation : { ...backup, schemaVersion, data }
      );
      for (const area of ['local', 'sync'] as const) {
        for (const operation of ['get', 'set', 'remove', 'clear'] as const) {
          vi.spyOn(fakeBrowser.storage[area], operation).mockImplementation(() => {
            throw new Error('Conversion must not access storage');
          });
        }
      }
      const NativeDate = Date;
      vi.spyOn(globalThis, 'Date').mockImplementation(function MockDate(...args: unknown[]) {
        if (args.length === 0) throw new Error('Conversion must not read the clock');
        return Reflect.construct(NativeDate, args);
      });
      vi.spyOn(Date, 'now').mockImplementation(() => {
        throw new Error('Conversion must not read the clock');
      });

      const expected = buildLearningDocument({
        ...converted,
        settings: {
          theme: 'light',
          language: 'zh-CN',
          maxNewCardsPerDay: 7,
          badgeEnabled: false,
          resetEditorOnReviewQueue: true,
        },
        dataUpdatedAt: backup.dataUpdatedAt,
      });
      expect(convertLearningDocument(installation)).toEqual(expected);
      expect(convertLearningDocument(installation)).toEqual(expected);
      expect(installation).toEqual(before);
      expect(parseLearningDocumentBackup(json)).toEqual(expected);
    }
  );

  it.each([undefined, 6])(
    'disables queue-opening reset when installation version %s has no reset overrides',
    (schemaVersion) => {
      const input =
        schemaVersion === FIRST_FLAT_DOCUMENT_VERSION
          ? { schemaVersion, cards: {}, stats: {}, settings: {} }
          : { schemaVersion };
      expect(convertLearningDocument(input)).toEqual(
        buildLearningDocument({ settings: { resetEditorOnReviewQueue: false } })
      );
    }
  );

  it('preserves an absent reset override in the current document format', () => {
    expect(convertLearningDocument(buildLearningDocument())).toEqual(buildLearningDocument());
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

  it.each([0, 1, 2, 3, 4, 5])(
    'allows absent installation collections and settings before v6 (version %i)',
    (schemaVersion) => {
      expect(convertLearningDocument({ schemaVersion })).toEqual(
        buildLearningDocument({ settings: { resetEditorOnReviewQueue: false } })
      );
    }
  );

  it.each([6, 7, 8])('requires document collections and settings from v6 (version %i)', (schemaVersion) => {
    for (const field of ['cards', 'stats', 'settings']) {
      const input = { ...buildLearningDocument(), stats: {}, schemaVersion, [field]: undefined };
      expect(() => convertLearningDocument(input)).toThrow();
      expect(() => parseLearningDocumentBackup(JSON.stringify(input))).toThrow();
    }
  });

  it.each(['frontendId', 'date'] as const)(
    'rejects broken %s relationships in current installations and backups',
    (kind) => {
      const { converted } = validLegacyBackup();
      if (kind === 'frontendId') converted.cards['1'].frontendId = 'different';
      if (kind === 'date') converted.reviewActivity.date = 'invalid';
      const document = buildLearningDocument({ ...converted, settings: {} });
      expect(() => convertLearningDocument(document)).toThrow();
      expect(() => parseLearningDocumentBackup(JSON.stringify(document))).toThrow();
    }
  );

  it.each([-1, LEARNING_DOCUMENT_VERSION + 1])('rejects unsupported schema version %j', (schemaVersion) => {
    const input = { schemaVersion, cards: {}, stats: {}, settings: {} };
    expect(() => convertLearningDocument(input)).toThrow();
    expect(() => parseLearningDocumentBackup(JSON.stringify(input))).toThrow();
  });
});

describe('parseLearningDocumentBackup', () => {
  const validBackup = { schemaVersion: 2, exportDate: '2024-01-01', data: { cards: {}, stats: {} } };

  it.each(['cards', 'stats'])('requires legacy backup %s even though installations can omit it', (field) => {
    expect(() =>
      parseLearningDocumentBackup(JSON.stringify({ ...validBackup, data: { ...validBackup.data, [field]: undefined } }))
    ).toThrow();
  });

  it.each([undefined, '2024-01-01T05:30:00+05:30', 'Mon, 01 Jan 2024 00:00:00 GMT'])(
    'preserves the legacy modification timestamp or export-time fallback: %s',
    (dataUpdatedAt) => {
      expect(parseLearningDocumentBackup(JSON.stringify({ ...validBackup, dataUpdatedAt })).dataUpdatedAt).toBe(
        dataUpdatedAt ?? validBackup.exportDate
      );
    }
  );

  it.each([6, 7, 8])('does not apply legacy export-time fallback to an unedited v%i document', (schemaVersion) => {
    expect(
      parseLearningDocumentBackup(
        JSON.stringify({ ...buildLearningDocument(), stats: {}, schemaVersion, exportDate: '2024-01-01' })
      )
    ).not.toHaveProperty('dataUpdatedAt');
  });

  it('rejects an invalid explicit modification timestamp instead of falling back to exportDate', () => {
    expect(() => parseLearningDocumentBackup(JSON.stringify({ ...validBackup, dataUpdatedAt: null }))).toThrow();
  });

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

  it('rejects invalid JSON', () => {
    expect(() => parseLearningDocumentBackup('{')).toThrow('Invalid JSON format');
  });
});
