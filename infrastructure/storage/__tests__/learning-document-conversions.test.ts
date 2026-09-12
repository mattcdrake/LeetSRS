import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { malformedBackupCases, mixedRecordBackup } from '@/test/utils/backup-mocks';
import { convertLearningDocument, parseLearningDocumentBackup } from '../learning-document';

describe('convertLearningDocument', () => {
  it('prepares an unversioned installation without inventing settings or an edit timestamp', () => {
    const { accepted, embedded } = mixedRecordBackup();
    const { domain: _domain, ...legacyCard } = accepted.cards['two-sum'];
    expect(
      convertLearningDocument({
        ...accepted,
        cards: { ...accepted.cards, 'two-sum': legacyCard },
        settings: { autoClearLeetcode: false, dayStartHour: 4, githubPat: 'secret' },
        gistSync: { gistId: 'old-gist', enabled: true },
        lastSyncTime: '2024-01-01',
      })
    ).toEqual({
      schemaVersion: 6,
      ...embedded,
      settings: { resetEditorOnEveryProblem: false },
    });
  });

  it.each([0, 1, 2, 3, 4, 5, 6])(
    'preserves the same learning data from installations and backups at version %i without I/O or a clock',
    (schemaVersion) => {
      const { payload, accepted, embedded } = mixedRecordBackup();
      const { domain: _domain, ...legacyCard } = accepted.cards['two-sum'];
      const data = {
        ...(schemaVersion < 4 ? accepted : embedded),
        ...(schemaVersion === 0 && { cards: { ...accepted.cards, 'two-sum': legacyCard } }),
        settings: { theme: 'light', language: 'zh-CN', maxNewCardsPerDay: 7 },
      };
      const installation = { ...data, schemaVersion, dataUpdatedAt: payload.dataUpdatedAt };
      const before = structuredClone(installation);
      const backup = JSON.stringify(schemaVersion === 6 ? installation : { ...payload, schemaVersion, data });
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

      const expected = { ...embedded, schemaVersion: 6, settings: data.settings, dataUpdatedAt: payload.dataUpdatedAt };
      expect(convertLearningDocument(installation)).toEqual(expected);
      expect(convertLearningDocument(installation)).toEqual(expected);
      expect(installation).toEqual(before);
      expect(parseLearningDocumentBackup(backup)).toEqual(expected);
    }
  );

  it.each([undefined, 0, 1, 2, 3, 4, 5])(
    'leaves empty installation version %s unedited with no overrides',
    (schemaVersion) => {
      expect(convertLearningDocument({ schemaVersion })).toEqual({
        schemaVersion: 6,
        cards: {},
        stats: {},
        settings: {},
      });
    }
  );

  it.each([undefined, '', ' \t\n ', 'x'.repeat(500)])('preserves embedded-note precedence for %j', (note) => {
    const { accepted } = mixedRecordBackup();
    const card = accepted.cards['two-sum'];
    expect(
      convertLearningDocument({
        schemaVersion: 2,
        cards: { 'two-sum': { ...card, ...(note !== undefined && { note }) } },
        notes: { [card.id]: { text: 'Legacy note' }, orphan: { text: 42 } },
        settings: { resetEditorOnEveryProblem: false, autoClearLeetcode: 'ignored', dayStartHour: null },
      })
    ).toEqual({
      schemaVersion: 6,
      cards: { 'two-sum': { ...card, ...(note === undefined ? { note: 'Legacy note' } : note ? { note } : {}) } },
      stats: {},
      settings: { resetEditorOnEveryProblem: false },
    });
  });

  it.each([null, '', false, 0])('defaults a falsy v0 domain %j but rejects it in v1', (domain) => {
    const { accepted } = mixedRecordBackup();
    const card = accepted.cards['two-sum'];
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

  it.each(['slug', 'duplicate', 'date'] as const)('rejects broken %s relationships in a current document', (kind) => {
    const { embedded } = mixedRecordBackup();
    if (kind === 'slug') embedded.cards['two-sum'].slug = 'different';
    if (kind === 'duplicate') embedded.cards['cn-problem'].id = 'valid-com';
    if (kind === 'date') embedded.stats['2024-01-01'].date = '2024-01-02';
    expect(() => convertLearningDocument({ ...embedded, schemaVersion: 6, settings: {} })).toThrow();
  });

  it.each([-1, 0.5, null, '5', 7])('rejects unsupported schema version %j', (schemaVersion) => {
    const input = { schemaVersion, cards: {}, stats: {}, settings: {} };
    expect(() => convertLearningDocument(input)).toThrow();
    expect(() => parseLearningDocumentBackup(JSON.stringify(input))).toThrow();
  });
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
      parseLearningDocumentBackup(
        JSON.stringify({ schemaVersion: 6, cards: {}, stats: {}, settings: {}, exportDate: '2024-01-01' })
      )
    ).not.toHaveProperty('dataUpdatedAt');
  });

  it('rejects invalid JSON and malformed owned notes even when an embedded note wins', () => {
    expect(() => parseLearningDocumentBackup('{')).toThrow('Invalid JSON format');
    const { accepted } = mixedRecordBackup();
    const card = { ...accepted.cards['two-sum'], note: 'Embedded' };
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
