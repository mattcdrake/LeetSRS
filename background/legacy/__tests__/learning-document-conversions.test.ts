import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  convertLearningDocument,
  parseLearningDocumentBackup,
} from '@/background/legacy/learning-document-conversions';
import { LEARNING_DOCUMENT_VERSION } from '@/shared/models';
import { malformedBackupCases, validLegacyBackup } from '@/test/utils/backup-mocks';
import { buildLearningDocument } from '@/test/utils/learning-document-mocks';

const FIRST_FLAT_DOCUMENT_VERSION = 6;

describe('convertLearningDocument', () => {
  it('removes redundant daily statistics fields while preserving meaningful counts', () => {
    expect(
      convertLearningDocument({
        schemaVersion: 7,
        cards: {},
        stats: {
          '2024-01-01': {
            date: '2024-01-01',
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
        stats: {
          '2024-01-01': {
            newCards: 3,
            streak: 9,
            gradeBreakdown: { 1: 1, 2: 2, 3: 3, 4: 4 },
          },
        },
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
          resetEditorOnReviewQueue: false,
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
        settings: data.settings,
        dataUpdatedAt: backup.dataUpdatedAt,
      });
      expect(convertLearningDocument(installation)).toEqual(expected);
      expect(convertLearningDocument(installation)).toEqual(expected);
      expect(installation).toEqual(before);
      expect(parseLearningDocumentBackup(json)).toEqual(expected);
    }
  );

  it.each([undefined, 0, 1, 2, 3, 4, 5, 6])(
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

  it.each([undefined, '', ' \t\n ', 'x'.repeat(500)])('preserves embedded-note precedence for %j', (note) => {
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
        cards: { 'two-sum': { ...card, ...(note === undefined ? { note: 'Legacy note' } : note ? { note } : {}) } },
        settings: { resetEditorOnReviewQueue: false },
      })
    );
  });

  it.each([null, '', false, 0])('defaults a falsy v0 domain %j but rejects it in v1', (domain) => {
    const { backup } = validLegacyBackup();
    const card = backup.data.cards['two-sum'];
    const input = { cards: { 'two-sum': { ...card, domain } } };
    expect(convertLearningDocument(input).cards['two-sum']).toEqual(card);
    expect(() => convertLearningDocument({ ...input, schemaVersion: 1 })).toThrow();
  });

  it.each([3, 4, 5])('validates the declared v%i contract before dropping retired fields', (schemaVersion) => {
    expect(() => convertLearningDocument({ schemaVersion, settings: { dayStartHour: null } })).toThrow(
      'retired settings'
    );
    if (schemaVersion >= 4) {
      expect(() => convertLearningDocument({ schemaVersion, notes: {} })).toThrow('separate notes field');
    }
  });

  it.each(['slug', 'duplicate', 'date'] as const)(
    'rejects broken %s relationships in current installations and backups',
    (kind) => {
      const { converted } = validLegacyBackup();
      if (kind === 'slug') converted.cards['two-sum'].slug = 'different';
      if (kind === 'duplicate') converted.cards['cn-problem'].id = 'valid-com';
      if (kind === 'date') Object.assign(converted.stats, { invalid: converted.stats['2024-01-01'] });
      const document = buildLearningDocument({ ...converted, settings: {} });
      expect(() => convertLearningDocument(document)).toThrow();
      expect(() => parseLearningDocumentBackup(JSON.stringify(document))).toThrow();
    }
  );

  it('rejects a broken date relationship in a v7 installation or backup', () => {
    const { legacyConverted } = validLegacyBackup();
    legacyConverted.stats['2024-01-01'].date = '2024-01-02';
    const document = { ...legacyConverted, schemaVersion: 7, settings: {} };
    expect(() => convertLearningDocument(document)).toThrow();
    expect(() => parseLearningDocumentBackup(JSON.stringify(document))).toThrow();
  });

  it.each([-1, 0.5, null, '5', LEARNING_DOCUMENT_VERSION + 1])(
    'rejects unsupported schema version %j',
    (schemaVersion) => {
      const input = { schemaVersion, cards: {}, stats: {}, settings: {} };
      expect(() => convertLearningDocument(input)).toThrow();
      expect(() => parseLearningDocumentBackup(JSON.stringify(input))).toThrow();
    }
  );
});

describe('parseLearningDocumentBackup', () => {
  const validBackup = { schemaVersion: 2, exportDate: '2024-01-01', data: { cards: {}, stats: {} } };

  it.each(malformedBackupCases(validBackup))('rejects malformed legacy backup: %s', (_name, json) => {
    expect(() => parseLearningDocumentBackup(json)).toThrow();
  });

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

  it('does not apply legacy export-time fallback to an unedited current document', () => {
    expect(
      parseLearningDocumentBackup(JSON.stringify({ ...buildLearningDocument(), exportDate: '2024-01-01' }))
    ).not.toHaveProperty('dataUpdatedAt');
  });

  it('rejects invalid JSON and malformed owned notes even when an embedded note wins', () => {
    expect(() => parseLearningDocumentBackup('{')).toThrow('Invalid JSON format');
    const { backup } = validLegacyBackup();
    const card = { ...backup.data.cards['two-sum'], note: 'Embedded' };
    expect(() =>
      parseLearningDocumentBackup(
        JSON.stringify({
          ...validBackup,
          data: { cards: { 'two-sum': card }, stats: {}, notes: { [card.id]: { text: 42 } } },
        })
      )
    ).toThrow();
  });
});
