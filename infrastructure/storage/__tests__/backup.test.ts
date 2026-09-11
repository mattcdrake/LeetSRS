import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { malformedBackupCases, mixedRecordBackup } from '@/test/utils/backup-mocks';
import { parseBackup } from '../backup';
import { removeDayStart } from '../migrations/003-remove-day-start';

const { payload, accepted } = mixedRecordBackup();
const backup = { ...payload, data: accepted };

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('parseBackup', () => {
  it.each([undefined, 0, 1, 2, 3])(
    'migrates legacy settings from schema %s without storage access',
    (schemaVersion) => {
      for (const area of ['local', 'sync'] as const) {
        for (const operation of ['get', 'set', 'remove', 'clear'] as const) {
          vi.spyOn(fakeBrowser.storage[area], operation).mockImplementation(() => {
            throw new Error('Parsing must not access storage');
          });
        }
      }
      const json = JSON.stringify({
        ...backup,
        schemaVersion,
        data: { ...accepted, settings: { autoClearLeetcode: true } },
      });

      expect(parseBackup(json)).toEqual({
        ...accepted,
        settings: { resetEditorOnEveryProblem: true },
        dataUpdatedAt: payload.dataUpdatedAt,
      });
    }
  );

  it('migrates historical fields before stripping or validating the current records', () => {
    const { domain: _domain, ...legacyCard } = accepted.cards['two-sum'];
    const rawData = {
      ...accepted,
      cards: { ...accepted.cards, 'two-sum': { ...legacyCard, historicalCard: { keep: true } } },
      settings: {
        dayStartHour: { malformed: 'discarded by migration 3' },
        autoClearLeetcode: false,
        historicalSetting: [1, 2],
      },
      historicalRoot: { keep: true },
    };
    // Observe the real migration: normalized output cannot prove that unrelated
    // historical fields survived parsing until their transformation.
    const transform = vi.spyOn(removeDayStart, 'migrate');
    const prepared = parseBackup(JSON.stringify({ ...backup, schemaVersion: 0, data: rawData }));
    expect(transform).toHaveBeenCalledWith({
      ...rawData,
      cards: { ...rawData.cards, 'two-sum': { ...rawData.cards['two-sum'], domain: 'leetcode.com' } },
    });

    expect(prepared).toEqual({
      ...accepted,
      settings: { resetEditorOnEveryProblem: false },
      dataUpdatedAt: payload.dataUpdatedAt,
    });
  });

  it.each([undefined, '', 0, false, null])('repairs a legacy falsy domain %j', (domain) => {
    const prepared = parseBackup(
      JSON.stringify({
        ...backup,
        schemaVersion: 0,
        data: { ...accepted, cards: { ...accepted.cards, 'two-sum': { ...accepted.cards['two-sum'], domain } } },
      })
    );
    expect(prepared.cards).toEqual(accepted.cards);
  });

  it.each<[number, unknown]>([
    [0, { ...accepted.cards['two-sum'], domain: 42 }],
    [0, null],
    [0, []],
    ...[1, 2, 3, 4].map((version): [number, unknown] => [version, { ...accepted.cards['two-sum'], domain: undefined }]),
  ])('rejects a schema %s record that its migrations cannot repair: %j', (schemaVersion, card) => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...backup,
          schemaVersion,
          data: { ...accepted, cards: { ...accepted.cards, 'two-sum': card } },
        })
      )
    ).toThrow();
  });

  it.each([
    [3, { autoClearLeetcode: false, dayStartHour: { retired: true } }, { resetEditorOnEveryProblem: false }],
    [3, { autoClearLeetcode: 'ignored', resetEditorOnEveryProblem: false }, { resetEditorOnEveryProblem: false }],
    [4, { autoClearLeetcode: true }, {}],
  ])('applies only the settings conversion for schema %s: %j', (schemaVersion, settings, expected) => {
    expect(parseBackup(JSON.stringify({ ...backup, schemaVersion, data: { ...accepted, settings } })).settings).toEqual(
      expected
    );
  });

  it('normalizes settings and strips unsupported fields from all current records', () => {
    const card = accepted.cards['two-sum'];
    const stats = accepted.stats['2024-01-01'];
    const prepared = parseBackup(
      JSON.stringify({
        ...backup,
        schemaVersion: 4,
        extra: true,
        data: {
          cards: { 'two-sum': { ...card, extra: true, fsrs: { ...card.fsrs, extra: true } } },
          stats: { '2024-01-01': { ...stats, extra: true, gradeBreakdown: { ...stats.gradeBreakdown, extra: true } } },
          notes: { [card.id]: { text: 'Keep this note', extra: true } },
          settings: { maxNewCardsPerDay: 8, theme: undefined, dayStartHour: 5, animationsEnabled: 'ignored' },
          gistSync: { gistId: 'incoming-gist', enabled: false, githubPat: 'ignored', extra: true },
          extra: true,
        },
      })
    );
    expect(prepared).toEqual({
      cards: { 'two-sum': card },
      stats: { '2024-01-01': stats },
      notes: { [card.id]: { text: 'Keep this note' } },
      settings: { maxNewCardsPerDay: 8 },
      gistSync: { gistId: 'incoming-gist', enabled: false },
      dataUpdatedAt: payload.dataUpdatedAt,
    });
  });

  it.each(['slug', 'duplicate', 'date', 'orphan'] as const)('rejects invalid %s relationships', (kind) => {
    const { accepted: data } = mixedRecordBackup();
    if (kind === 'slug') data.cards['two-sum'].slug = 'different';
    if (kind === 'duplicate') data.cards['cn-problem'].id = 'valid-com';
    if (kind === 'date') data.stats['2024-01-01'].date = '2024-01-02';
    if (kind === 'orphan') delete (data.cards as Record<string, unknown>)['two-sum'];
    expect(() => parseBackup(JSON.stringify({ ...backup, data }))).toThrow();
  });

  it.each(['cards', 'stats', 'notes'] as const)('rejects mixed invalid current %s', (collection) => {
    expect(() =>
      parseBackup(
        JSON.stringify({ ...backup, schemaVersion: 4, data: { ...accepted, [collection]: payload.data[collection] } })
      )
    ).toThrow();
  });

  it.each([
    ...malformedBackupCases(backup),
    ['invalid JSON', 'invalid json'],
    ['future schema version', JSON.stringify({ ...backup, schemaVersion: 5 })],
    ['null root', 'null'],
    ['array root', '[]'],
    ['missing export date', JSON.stringify({ data: {} })],
    ['missing data', JSON.stringify({ exportDate: payload.exportDate })],
    ...['cards', 'stats', 'notes', 'data'].flatMap((key) =>
      [undefined, null].map((value) => [
        `${key} ${value}`,
        JSON.stringify({ ...backup, ...(key === 'data' ? { data: value } : { data: { ...accepted, [key]: value } }) }),
      ])
    ),
    [
      'invalid current reset setting',
      JSON.stringify({
        ...backup,
        data: { ...accepted, settings: { resetEditorOnEveryProblem: null, autoClearLeetcode: true } },
      }),
    ],
    [
      'oversized note',
      JSON.stringify({ ...backup, data: { ...accepted, notes: { 'valid-com': { text: 'a'.repeat(501) } } } }),
    ],
  ])('rejects %s', (_name, json) => {
    expect(() => parseBackup(json)).toThrow();
  });

  it.each([undefined, 0, 1705222800000])('round-trips numeric dates and last_review %s', (lastReview) => {
    const card = accepted.cards['two-sum'];
    const data = {
      ...accepted,
      cards: {
        ...accepted.cards,
        'two-sum': { ...card, createdAt: 0, fsrs: { ...card.fsrs, due: 0, last_review: lastReview } },
      },
    };
    const prepared = parseBackup(JSON.stringify({ ...backup, schemaVersion: 4, data }));
    const { dataUpdatedAt, ...records } = prepared;
    expect(parseBackup(JSON.stringify({ ...backup, schemaVersion: 4, dataUpdatedAt, data: records }))).toEqual(
      prepared
    );
    expect(prepared.cards).toEqual(data.cards);
    expect(prepared.dataUpdatedAt).toBe(payload.dataUpdatedAt);
  });

  it.each(['2024-01-01T00:00:00.000Z', '2024-01-01T05:30:00+05:30', '2024-01-01', 'Mon, 01 Jan 2024 00:00:00 GMT'])(
    'preserves the supported timestamp format %s',
    (timestamp) => {
      expect(
        parseBackup(JSON.stringify({ ...backup, exportDate: timestamp, dataUpdatedAt: timestamp })).dataUpdatedAt
      ).toBe(timestamp);
    }
  );

  it('leaves an absent update timestamp for the import service to supply', () => {
    expect(parseBackup(JSON.stringify({ ...backup, dataUpdatedAt: undefined })).dataUpdatedAt).toBeUndefined();
  });
});
