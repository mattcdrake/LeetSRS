import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { z } from 'zod';
import { requireDefined } from '@/test/utils/assertions';
import { createMockCard } from '@/test/utils/card-mocks';
import { getAllCards } from '../../cards';
import { STORAGE_KEYS } from '../../storage-keys';
import type { addCardDomain } from '../001-add-card-domain';
import type { addSystemTheme } from '../002-add-system-theme';
import type { removeDayStart } from '../003-remove-day-start';
import { LATEST_SCHEMA_VERSION, migrateBackupData, runStartupMigrations, setSchemaVersion } from '../runner';

describe('migrations', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('migrateBackupData', () => {
    it.each([undefined, 0, 1, 2, 3])('preserves the complete frozen dataset from schema %s', async (schemaVersion) => {
      const { domain: _domain, ...legacyCard } = createMockCard(State.Review, { slug: 'two-sum', paused: true });
      const card = Object.freeze({
        ...legacyCard,
        fsrs: Object.freeze({ ...legacyCard.fsrs, historicalSchedule: { interval: 12 } }),
        ...(schemaVersion ? { domain: 'leetcode.cn' } : {}),
        historicalCard: { source: 'legacy' },
      });
      const data = Object.freeze({
        cards: Object.freeze({ 'two-sum': card }),
        notes: Object.freeze({ [card.id]: { text: 'Keep this note', revision: 7 } }),
        stats: Object.freeze({ '2024-01-01': { totalReviews: 9, historicalStat: true } }),
        settings: Object.freeze({
          theme: 'dark',
          ...(schemaVersion !== 3 && { dayStartHour: 4 }),
          historicalSetting: [1, 2],
        }),
        gistSync: Object.freeze({ gistId: 'old-gist', enabled: false, historicalConfig: true }),
        historicalRoot: Object.freeze({ value: 'keep' }),
        ['__proto__']: Object.freeze({ legalJsonKey: true }),
      });
      const before = JSON.stringify(data);
      const migrated = migrateBackupData(data, schemaVersion);

      expect(migrated).toEqual({
        ...data,
        cards: { 'two-sum': { ...card, domain: schemaVersion ? 'leetcode.cn' : 'leetcode.com' } },
        settings: schemaVersion === 3 ? data.settings : { theme: 'dark', historicalSetting: [1, 2] },
      });
      expect(migrateBackupData(data, schemaVersion)).toEqual(migrated);
      expect(JSON.stringify(data)).toBe(before);
      expect(await fakeBrowser.storage.local.get(null)).toEqual({});
      expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
    });

    it.each([1, 2, 3])('does not reapply the domain migration to schema %s', (schemaVersion) => {
      const data = { cards: { 'two-sum': createMockCard(State.Review, { slug: 'two-sum' }) } };
      expect(migrateBackupData(data, schemaVersion)).toEqual(data);
    });

    it.each([-1, 0.5, LATEST_SCHEMA_VERSION + 1, NaN, Infinity, '0', null, true, {}, []])(
      'rejects unsupported schema %s',
      (schemaVersion) => {
        expect(() => migrateBackupData({ cards: {} }, schemaVersion)).toThrow('Unsupported schema version');
      }
    );

    it('defaults only missing or falsy domains, preserving malformed records and legal JSON keys', () => {
      const cards = Object.freeze({
        missing: Object.freeze({ name: 'Legacy', ['__proto__']: { historical: true } }),
        empty: Object.freeze({ domain: '' }),
        zero: Object.freeze({ domain: 0 }),
        no: Object.freeze({ domain: false }),
        nil: Object.freeze({ domain: null }),
        truthy: Object.freeze({ domain: 42 }),
        objectDomain: Object.freeze({ domain: { historical: 'region' } }),
        nullRecord: null,
        arrayRecord: Object.freeze([1, 'legacy']),
        stringRecord: 'legacy',
        numericRecord: 0,
        booleanRecord: false,
        ['__proto__']: Object.freeze({ name: 'Legal slug', domain: null }),
        constructor: Object.freeze({ name: 'Another legal slug' }),
      });
      const settings = Object.freeze({ dayStartHour: 'malformed but retired', ['__proto__']: { keep: true } });
      const data = Object.freeze({ cards, settings });
      const before = JSON.stringify(data);
      const migrated = migrateBackupData(data, 0);

      expect(migrated).toEqual({
        cards: {
          ...cards,
          missing: { ...cards.missing, domain: 'leetcode.com' },
          empty: { domain: 'leetcode.com' },
          zero: { domain: 'leetcode.com' },
          no: { domain: 'leetcode.com' },
          nil: { domain: 'leetcode.com' },
          ['__proto__']: { name: 'Legal slug', domain: 'leetcode.com' },
          constructor: { name: 'Another legal slug', domain: 'leetcode.com' },
        },
        settings: { ['__proto__']: { keep: true } },
      });
      expect(JSON.stringify(data)).toBe(before);
      expect(migrateBackupData(data, 0)).toEqual(migrated);
    });

    it.each([1, 2, 3])('preserves malformed unrelated data after schema %s without reapplying version 1', (version) => {
      const data = {
        cards: { malformedDomain: { domain: 42 }, malformedRecord: null, arrayRecord: [], booleanRecord: false },
        notes: ['historical note layout'],
        stats: 'historical statistics',
        settings: { theme: 42, ...(version !== 3 && { dayStartHour: null }), ['__proto__']: 'legal setting key' },
      };
      expect(migrateBackupData(data, version)).toEqual({
        ...data,
        settings: version === 3 ? data.settings : { theme: 42, ['__proto__']: 'legal setting key' },
      });
    });

    it.each([null, [], false, 42, 'legacy'])('rejects a malformed cards collection in version 1: %s', (cards) => {
      expect(() => migrateBackupData({ cards }, 0)).toThrow('Migration 1');
      expect(() => migrateBackupData({ cards }, 1)).toThrow('Migration 2');
      expect(() => migrateBackupData({ cards }, 2)).toThrow('Migration 3');
      expect(() => migrateBackupData({ cards }, 3)).toThrow('Migration 4');
      expect(migrateBackupData({ cards }, 4)).toEqual({ cards });
    });

    it.each([null, [], false, 42, 'legacy'])('rejects a malformed settings container in version 3: %s', (settings) => {
      expect(() => migrateBackupData({ settings }, 2)).toThrow('Migration 3');
      expect(() => migrateBackupData({ settings }, 3)).toThrow('Migration 4');
      expect(migrateBackupData({ settings }, 4)).toEqual({ settings });
    });

    it.each([null, [], false, 42, 'legacy'])(
      'rejects an invalid dataset only when a concrete migration needs an object: %s',
      (data) => {
        expect(() => migrateBackupData(data, 0)).toThrow('Migration 1');
        expect(() => migrateBackupData(data, 2)).toThrow('Migration 3');
        expect(() => migrateBackupData(data, 3)).toThrow('Migration 4');
        expect(migrateBackupData(data, 4)).toBe(data);
      }
    );

    it('declares concrete output contracts, including preserved malformed cards and identity types', () => {
      expectTypeOf<typeof addCardDomain.migrate>().returns.toEqualTypeOf<{
        [key: string]: unknown;
        cards?: Record<
          string,
          | (Record<string, unknown> & { domain: NonNullable<unknown> })
          | null
          | undefined
          | string
          | number
          | boolean
          | unknown[]
        >;
      }>();
      type Version1 = ReturnType<typeof addCardDomain.migrate>;
      type Version2 = ReturnType<typeof addSystemTheme.migrate>;
      type Version3 = ReturnType<typeof removeDayStart.migrate>;
      expectTypeOf<typeof addSystemTheme.load>().returns.resolves.toEqualTypeOf<Version1>();
      expectTypeOf<Version2>().toEqualTypeOf<Version1>();
      expectTypeOf<typeof removeDayStart.load>().returns.resolves.toEqualTypeOf<Version2>();
      expectTypeOf<typeof addCardDomain.save>().parameter(0).toEqualTypeOf<Version1>();
      expectTypeOf<typeof addSystemTheme.save>().parameter(0).toEqualTypeOf<Version2>();
      expectTypeOf<typeof removeDayStart.save>().parameter(0).toEqualTypeOf<Version3>();
      expectTypeOf<Version3>().toExtend<Version2>();
      expectTypeOf<Version3['settings']>().toEqualTypeOf<
        (Record<string, unknown> & { dayStartHour?: never }) | undefined
      >();
    });
  });

  describe('setSchemaVersion', () => {
    it('should set schema version', async () => {
      await setSchemaVersion(3);
      const stored = await storage.getItem(STORAGE_KEYS.schemaVersion);
      expect(stored).toBe(3);
    });
  });

  describe('runStartupMigrations', () => {
    it.each([-1, 0.5, 5, '1', null, true, {}, []])(
      'rejects malformed or unsupported completed version %j before writes',
      async (version) => {
        await fakeBrowser.storage.local.set({ 'leetsrs:schemaVersion': version, unrelated: 'keep' });
        await storage.setItem('sync:leetsrs:dayStartHour', 4);
        const localBefore = await fakeBrowser.storage.local.get(null);
        const syncBefore = await fakeBrowser.storage.sync.get(null);
        // fakeBrowser deletes null values; supply the raw stored null at the storage boundary.
        const read =
          version === null
            ? vi.spyOn(storage, 'snapshot').mockResolvedValueOnce({ ...localBefore, 'leetsrs:schemaVersion': null })
            : undefined;
        try {
          await expect(runStartupMigrations()).rejects.toThrow('Unsupported schema version');
          expect(await fakeBrowser.storage.local.get(null)).toEqual(localBefore);
          expect(await fakeBrowser.storage.sync.get(null)).toEqual(syncBefore);
        } finally {
          read?.mockRestore();
        }
      }
    );

    it.each([1, 2])(
      'rejects schema %s data that does not satisfy its predecessor contract without repairing it',
      async (version) => {
        const cards = { missingDomain: { name: 'Two Sum' } };
        await setSchemaVersion(version);
        await storage.setItem(STORAGE_KEYS.cards, cards);
        await storage.setItem('sync:leetsrs:dayStartHour', 4);
        const localBefore = await fakeBrowser.storage.local.get(null);
        const syncBefore = await fakeBrowser.storage.sync.get(null);

        await expect(runStartupMigrations()).rejects.toThrow(`Failed to run migration ${version + 1}`);
        expect(() => migrateBackupData({ cards }, version)).toThrow(`Migration ${version + 1}`);
        expect(await fakeBrowser.storage.local.get(null)).toEqual(localBefore);
        expect(await fakeBrowser.storage.sync.get(null)).toEqual(syncBefore);
      }
    );

    it.each(['none', 'save', 'cleanup'] as const)(
      'hands each persisted output to the next loader across shape changes and a storage move (failure: %s)',
      async (failure) => {
        const source = { titles: ['Two Sum', 'Add Two Numbers'] };
        const steps = [
          {
            description: 'Extract titles into an array',
            async load(): Promise<typeof source> {
              return requireDefined(await storage.getItem<typeof source>('local:test:source'));
            },
            migrate(data: unknown): string[] {
              return z.object({ titles: z.array(z.string()) }).parse(data).titles;
            },
            async save(data: string[]): Promise<void> {
              await storage.setItem('local:test:titles', data);
            },
            async cleanup(): Promise<void> {
              await storage.removeItem('local:test:source');
            },
          },
          {
            description: 'Move titles to sync without changing their logical shape',
            async load(): Promise<string[]> {
              return requireDefined(await storage.getItem<string[]>('local:test:titles'));
            },
            migrate(data: unknown): string[] {
              return z.array(z.string()).parse(data);
            },
            async save(data: string[]): Promise<void> {
              await storage.setItem('sync:test:titles', data);
            },
            async cleanup(): Promise<void> {
              await storage.removeItem('local:test:titles');
            },
          },
          {
            description: 'Wrap the moved titles in a different dataset shape',
            async load(): Promise<string[]> {
              return requireDefined(await storage.getItem<string[]>('sync:test:titles'));
            },
            migrate(data: unknown): { names: string[] } {
              return { names: z.array(z.string()).parse(data) };
            },
            async save(data: { names: string[] }): Promise<void> {
              await storage.setItems([
                { key: 'local:test:destination', value: data },
                { key: 'local:test:count', value: data.names.length },
              ]);
            },
            async cleanup(): Promise<void> {
              await storage.removeItem('sync:test:titles');
            },
          },
        ];
        await storage.setItem('local:test:source', source);
        await storage.setItem('local:test:unrelated', { history: 'keep' });

        if (failure !== 'none') {
          const operation =
            failure === 'save'
              ? vi.spyOn(storage, 'setItem').mockRejectedValueOnce(new Error('destination unavailable'))
              : vi.spyOn(storage, 'removeItem').mockRejectedValueOnce(new Error('cleanup unavailable'));
          try {
            await expect(runStartupMigrations(steps)).rejects.toThrow('Failed to run migration 1');
            expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBeNull();
            expect(await storage.getItem('local:test:source')).toEqual(source);
            expect(await storage.getItem('local:test:titles')).toEqual(
              failure === 'save' ? null : ['Two Sum', 'Add Two Numbers']
            );
            expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
          } finally {
            operation.mockRestore();
          }
        }

        await runStartupMigrations(steps);
        await runStartupMigrations(steps);

        expect(await fakeBrowser.storage.local.get(null)).toEqual({
          'test:destination': { names: ['Two Sum', 'Add Two Numbers'] },
          'test:count': 2,
          'test:unrelated': { history: 'keep' },
          'leetsrs:schemaVersion': 3,
        });
        expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
        // All historical locations now contain different installed data. Backup
        // migration must neither read, overwrite, nor clean up those locations.
        await storage.setItems([
          { key: 'local:test:source', value: { titles: ['Installed source'] } },
          { key: 'local:test:titles', value: ['Installed local titles'] },
          { key: 'sync:test:titles', value: ['Installed sync titles'] },
          { key: 'local:test:destination', value: { names: ['Installed destination'] } },
        ]);
        const before = await fakeBrowser.storage.local.get(null);
        const syncBefore = await fakeBrowser.storage.sync.get(null);
        expect(migrateBackupData(source, 0, steps)).toEqual({ names: ['Two Sum', 'Add Two Numbers'] });
        expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
        expect(await fakeBrowser.storage.sync.get(null)).toEqual(syncBefore);
      }
    );

    it.each([undefined, 0, 1, 2, 3])('upgrades the complete schema %s dataset and is repeatable', async (version) => {
      if (version !== undefined) await setSchemaVersion(version);
      const { domain: _domain, ...legacyCard } = createMockCard(State.Review, { paused: true });
      const card = {
        ...legacyCard,
        historicalCard: { source: 'legacy' },
        ...(version ? { domain: 'leetcode.cn' } : {}),
      };
      const cards = { [card.slug]: card, ['__proto__']: { domain: 'leetcode.cn', historical: true } };
      const stats = { '2024-01-01': { totalReviews: 9, historicalStat: 'keep' } };
      await storage.setItem(STORAGE_KEYS.cards, cards);
      await storage.setItem(STORAGE_KEYS.stats, stats);
      await storage.setItem(`${STORAGE_KEYS.notes}:${card.id}`, { text: 'Keep this note', historicalNote: true });
      await storage.setItem(`${STORAGE_KEYS.notes}:__proto__`, { text: 'Legal note key' });
      await storage.setItem('local:leetsrs:historicalData', { value: 'keep' });
      if (version !== 3) await storage.setItem('sync:leetsrs:dayStartHour', 4);
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem('sync:leetsrs:historicalSetting', { ['__proto__']: 'keep' });
      const localBefore = await fakeBrowser.storage.local.get(null);
      const syncBefore = await fakeBrowser.storage.sync.get(null);
      const { 'leetsrs:dayStartHour': _retired, ...remainingSettings } = syncBefore;

      await runStartupMigrations();
      await runStartupMigrations();

      expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(4);
      expect(await fakeBrowser.storage.local.get(null)).toEqual({
        ...localBefore,
        'leetsrs:schemaVersion': 4,
        'leetsrs:cards': { ...cards, [card.slug]: { ...card, domain: version ? 'leetcode.cn' : 'leetcode.com' } },
      });
      expect(await fakeBrowser.storage.sync.get(null)).toEqual(version === 3 ? syncBefore : remainingSettings);
    });
  });

  describe('migration v1: add domain to cards', () => {
    it('changes only missing domains while preserving schedules, pause state, notes, and unrelated storage', async () => {
      const { domain: _domain, ...legacyCard } = createMockCard(State.Review, {
        id: 'legacy-id',
        slug: 'two-sum',
        paused: true,
      });
      const cards = {
        'two-sum': legacyCard,
        'add-two-numbers': createMockCard(State.Learning, {
          id: 'cn-id',
          slug: 'add-two-numbers',
          domain: 'leetcode.cn',
        }),
      };
      await storage.setItem(STORAGE_KEYS.cards, cards);
      await storage.setItem(`${STORAGE_KEYS.notes}:legacy-id`, { text: 'Keep this note' });
      await storage.setItem(`${STORAGE_KEYS.notes}:cn-id`, { text: 'Keep this too' });
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-01T00:00:00.000Z');
      const before = await fakeBrowser.storage.local.get(null);

      await runStartupMigrations();

      expect(await getAllCards()).toEqual([{ ...legacyCard, domain: 'leetcode.com' }, cards['add-two-numbers']]);
      expect(await fakeBrowser.storage.local.get(null)).toEqual({
        ...before,
        [STORAGE_KEYS.cards.slice('local:'.length)]: {
          ...cards,
          'two-sum': { ...cards['two-sum'], domain: 'leetcode.com' },
        },
        [STORAGE_KEYS.schemaVersion.slice('local:'.length)]: 4,
      });
    });

    it('does not advance the schema when migrated cards cannot be persisted', async () => {
      const cards = { 'two-sum': createMockCard(State.New, { slug: 'two-sum' }) };
      await storage.setItem(STORAGE_KEYS.cards, cards);
      const write = storage.setItem.bind(storage);
      const writes = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
        if (key === STORAGE_KEYS.cards) throw new Error('card persistence failed');
        return write(key, value);
      });
      try {
        await expect(runStartupMigrations()).rejects.toThrow('Failed to run migration 1');
        expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBeNull();
        expect(writes.mock.calls.map(([key]) => key)).not.toContain(STORAGE_KEYS.schemaVersion);
      } finally {
        writes.mockRestore();
      }
    });

    it('safely retries startup after cards are saved but the schema version write fails', async () => {
      const { domain: _domain, ...legacyCard } = createMockCard(State.Review, {
        id: 'legacy-id',
        slug: 'two-sum',
        paused: true,
      });
      const cards = {
        'two-sum': legacyCard,
        'add-two-numbers': createMockCard(State.Learning, {
          id: 'cn-id',
          slug: 'add-two-numbers',
          domain: 'leetcode.cn',
        }),
      };
      await storage.setItem(STORAGE_KEYS.cards, cards);
      await storage.setItem(`${STORAGE_KEYS.notes}:legacy-id`, { text: 'Keep this note' });
      await storage.setItem(`${STORAGE_KEYS.notes}:cn-id`, { text: 'Keep this too' });
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-01T00:00:00.000Z');
      const before = await fakeBrowser.storage.local.get(null);
      const expectedAfterCardWrite = {
        ...before,
        [STORAGE_KEYS.cards.slice('local:'.length)]: {
          ...cards,
          'two-sum': { ...cards['two-sum'], domain: 'leetcode.com' },
        },
      };
      const write = storage.setItem.bind(storage);
      const writes = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
        if (key === STORAGE_KEYS.schemaVersion) throw new Error('schema persistence failed');
        return write(key, value);
      });
      try {
        await expect(runStartupMigrations()).rejects.toThrow('schema persistence failed');
        expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBeNull();
        expect(await fakeBrowser.storage.local.get(null)).toEqual(expectedAfterCardWrite);
      } finally {
        writes.mockRestore();
      }

      // A new startup sees the persisted cards and the old schema version.
      await runStartupMigrations();

      expect(await fakeBrowser.storage.local.get(null)).toEqual({
        ...expectedAfterCardWrite,
        [STORAGE_KEYS.schemaVersion.slice('local:'.length)]: 4,
      });
    });

    it('should handle empty or missing cards storage', async () => {
      await runStartupMigrations();

      expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(4);
    });
  });

  describe('migration v3: remove configurable day start', () => {
    it('removes the legacy setting while retaining cards, history, and other settings', async () => {
      await setSchemaVersion(2);
      const card = createMockCard(State.Review);
      await storage.setItem(STORAGE_KEYS.cards, { [card.slug]: card });
      await storage.setItem(STORAGE_KEYS.stats, { '2024-03-14': { streak: 7 } });
      await storage.setItem('sync:leetsrs:dayStartHour', 4);
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, 8);
      const localBefore = await fakeBrowser.storage.local.get(null);
      const syncBefore = await fakeBrowser.storage.sync.get(null);
      const { 'leetsrs:dayStartHour': _legacy, ...remainingSettings } = syncBefore;

      await runStartupMigrations();
      await runStartupMigrations();

      expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(4);
      expect(await fakeBrowser.storage.sync.get(null)).toEqual(remainingSettings);
      expect(await fakeBrowser.storage.local.get(null)).toEqual({
        ...localBefore,
        'leetsrs:schemaVersion': 4,
      });
    });

    it('retries legacy setting removal before advancing the schema after a storage failure', async () => {
      await setSchemaVersion(2);
      await storage.setItem('sync:leetsrs:dayStartHour', 4);
      const remove = vi.spyOn(storage, 'removeItems').mockRejectedValueOnce(new Error('storage unavailable'));
      try {
        await expect(runStartupMigrations()).rejects.toThrow('Failed to run migration 3');
        expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(2);
        await runStartupMigrations();
        expect(await storage.getItem('sync:leetsrs:dayStartHour')).toBeNull();
        expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(4);
      } finally {
        remove.mockRestore();
      }
    });
  });

  describe('migration v2: add system theme preference', () => {
    it('should advance the schema without changing an existing theme', async () => {
      await setSchemaVersion(1);
      await storage.setItem(STORAGE_KEYS.theme, 'dark');

      await runStartupMigrations();

      expect(await storage.getItem(STORAGE_KEYS.schemaVersion)).toBe(4);
      expect(await storage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    });
  });
});
