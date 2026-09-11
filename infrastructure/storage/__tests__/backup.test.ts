import { State } from 'ts-fsrs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
import { createMockCard } from '@/test/utils/card-mocks';
import { parseBackup } from '../backup';

describe('parseBackup', () => {
  it.each([undefined, '', '   ', 'Saved note'])('parses embedded note %j without a separate collection', (note) => {
    const card = createMockCard(State.Review, { slug: 'two-sum' });
    const parsed = parseBackup(
      JSON.stringify({
        schemaVersion: 4,
        exportDate: '2024-01-01',
        data: { cards: { 'two-sum': { ...card, note } }, stats: {} },
      })
    );
    expect(parsed.cards['two-sum']).toEqual({ ...card, ...(note ? { note } : {}) });
    expect(parsed).not.toHaveProperty('notes');
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([{}, [], null, { orphan: { text: 'Legacy' } }])(
    'rejects a separate notes field in version 4 before stripping extras: %j',
    (notes) => {
      expect(() =>
        parseBackup(
          JSON.stringify({
            schemaVersion: 4,
            exportDate: '2024-01-01',
            data: { cards: {}, stats: {}, notes },
          })
        )
      ).toThrow('separate notes field');
    }
  );

  it.each([undefined, '', ' \t\n ', 'x'.repeat(500)])(
    'normalizes legacy note %j and discards malformed orphans',
    (text) => {
      const card = createMockCard(State.Review, { slug: 'two-sum', id: 'owner' });
      const parsed = parseBackup(
        JSON.stringify({
          schemaVersion: 3,
          exportDate: '2024-01-01',
          data: {
            cards: { 'two-sum': card },
            stats: {},
            notes: { orphan: { text: 42 }, ...(text !== undefined && { owner: { text } }) },
          },
        })
      );
      expect(parsed.cards).toEqual({ 'two-sum': { ...card, ...(text ? { note: text } : {}) } });
      expect(parsed).not.toHaveProperty('notes');
    }
  );

  it.each([undefined, 0, 1, 2, 3])(
    'preserves learning data from version %s without storage or clock access',
    (schemaVersion) => {
      const { payload, accepted, embedded } = mixedRecordBackup();
      const { domain: _domain, ...legacyCard } = accepted.cards['two-sum'];
      const data = {
        ...accepted,
        cards: { ...accepted.cards, 'two-sum': schemaVersion ? accepted.cards['two-sum'] : legacyCard },
        settings:
          schemaVersion === 3
            ? { resetEditorOnEveryProblem: false }
            : { dayStartHour: { retired: true }, autoClearLeetcode: false },
        gistSync: { gistId: 'incoming-gist', enabled: false },
      };
      for (const area of ['local', 'sync'] as const) {
        for (const operation of ['get', 'set', 'remove', 'clear'] as const) {
          vi.spyOn(fakeBrowser.storage[area], operation).mockImplementation(() => {
            throw new Error('Parsing must not access storage');
          });
        }
      }
      // Date.parse is allowed, but consulting the current time is not.
      const NativeDate = Date;
      vi.spyOn(globalThis, 'Date').mockImplementation(function MockDate(...args: unknown[]) {
        if (args.length === 0) throw new Error('Parsing must not read the clock');
        return Reflect.construct(NativeDate, args);
      });
      vi.spyOn(Date, 'now').mockImplementation(() => {
        throw new Error('Parsing must not read the clock');
      });
      expect(parseBackup(JSON.stringify({ ...payload, schemaVersion, data, dataUpdatedAt: undefined }))).toEqual({
        ...embedded,
        settings: { resetEditorOnEveryProblem: false },
        gistSync: { gistId: 'incoming-gist', enabled: false },
        dataUpdatedAt: payload.exportDate,
      });
    }
  );

  it('filters extras after migration while preserving valid current settings over malformed legacy data', () => {
    const { payload, accepted, embedded } = mixedRecordBackup();
    const card = accepted.cards['two-sum'];
    const stats = accepted.stats['2024-01-01'];
    expect(
      parseBackup(
        JSON.stringify({
          ...payload,
          extra: true,
          data: {
            ...accepted,
            extra: true,
            cards: { ...accepted.cards, 'two-sum': { ...card, extra: true, fsrs: { ...card.fsrs, extra: true } } },
            stats: {
              '2024-01-01': { ...stats, extra: true, gradeBreakdown: { ...stats.gradeBreakdown, extra: true } },
            },
            notes: { ...accepted.notes, 'valid-com': { text: 'Keep this note', extra: true } },
            settings: {
              resetEditorOnEveryProblem: false,
              autoClearLeetcode: 'ignored',
              dayStartHour: null,
              animationsEnabled: false,
              extra: true,
            },
            gistSync: { gistId: 'incoming-gist', enabled: false, githubPat: 'ignored', extra: true },
          },
        })
      )
    ).toEqual({
      ...embedded,
      settings: { resetEditorOnEveryProblem: false },
      gistSync: { gistId: 'incoming-gist', enabled: false },
      dataUpdatedAt: payload.dataUpdatedAt,
    });
  });

  it.each(['slug', 'duplicate', 'date'] as const)('rejects broken %s relationships', (kind) => {
    const { payload, accepted } = mixedRecordBackup();
    if (kind === 'slug') accepted.cards['two-sum'].slug = 'different';
    if (kind === 'duplicate') accepted.cards['cn-problem'].id = 'valid-com';
    if (kind === 'date') accepted.stats['2024-01-01'].date = '2024-01-02';
    expect(() => parseBackup(JSON.stringify({ ...payload, data: accepted }))).toThrow();
  });

  it.each([
    { cards: { invalid: null } },
    { settings: { resetEditorOnEveryProblem: null, autoClearLeetcode: true } },
    { settings: { theme: 'invalid' } },
    { stats: { '2024-01-01': { date: '2024-01-01', totalReviews: -1 } } },
    { notes: { 'valid-com': { text: 42 } } },
  ])('rejects invalid supported data after historical migration: %j', (invalid) => {
    const { payload, accepted } = mixedRecordBackup();
    expect(() => parseBackup(JSON.stringify({ ...payload, data: { ...accepted, ...invalid } }))).toThrow();
  });

  it.each([
    { schemaVersion: 5 },
    { schemaVersion: -1 },
    { schemaVersion: null },
    { schemaVersion: 1.5 },
    { exportDate: undefined },
    { exportDate: null },
    { exportDate: 'not-a-date' },
    { dataUpdatedAt: null },
    { dataUpdatedAt: 'not-a-date' },
  ])('rejects invalid metadata: %j', (metadata) => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          schemaVersion: 3,
          exportDate: '2024-01-01',
          data: { cards: {}, stats: {}, notes: {} },
          ...metadata,
        })
      )
    ).toThrow();
  });

  it('reports invalid JSON', () => {
    expect(() => parseBackup('{')).toThrow('Invalid JSON format');
  });

  it.each(['2024-01-01T05:30:00+05:30', 'Mon, 01 Jan 2024 00:00:00 GMT'])(
    'preserves supplied timestamp text: %s',
    (dataUpdatedAt) => {
      expect(
        parseBackup(
          JSON.stringify({
            schemaVersion: 3,
            exportDate: '2025-01-01',
            dataUpdatedAt,
            data: { cards: {}, stats: {}, notes: {} },
          })
        ).dataUpdatedAt
      ).toBe(dataUpdatedAt);
    }
  );

  it.each([
    { dayStartHour: 4 },
    { autoClearLeetcode: true },
    { dayStartHour: null, resetEditorOnEveryProblem: false },
    { autoClearLeetcode: 'invalid', resetEditorOnEveryProblem: false },
  ])('rejects retired settings in the declared latest version: %j', (settings) => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          schemaVersion: 3,
          exportDate: '2024-01-01',
          data: { cards: {}, stats: {}, notes: {}, settings },
        })
      )
    ).toThrow('retired settings');
  });

  it('returns replacement data synchronously using exportDate when dataUpdatedAt is absent', () => {
    expect(
      parseBackup(
        JSON.stringify({
          schemaVersion: 3,
          exportDate: '2024-01-01T05:30:00+05:30',
          data: { cards: {}, stats: {}, notes: {} },
        })
      )
    ).toEqual({ cards: {}, stats: {}, settings: {}, dataUpdatedAt: '2024-01-01T05:30:00+05:30' });
  });
});
