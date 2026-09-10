import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { createMockCard } from '@/test/utils/card-mocks';
import { getAllCards } from '../cards';
import { getCurrentSchemaVersion, migrateBackupData, runStartupMigrations, setSchemaVersion } from '../migrations';
import { STORAGE_KEYS } from '../storage-keys';

describe('migrations', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('migrateBackupData', () => {
    it('preserves legal JSON keys while validating historical datasets and collections', () => {
      const data: unknown = JSON.parse(
        '{"__proto__":{"text":"unrelated"},"cards":{"__proto__":{}},"settings":{"__proto__":{"text":"setting"},"dayStartHour":4}}'
      );
      expect(migrateBackupData(data, 0)).toEqual(
        JSON.parse(
          '{"__proto__":{"text":"unrelated"},"cards":{"__proto__":{"domain":"leetcode.com"}},"settings":{"__proto__":{"text":"setting"}}}'
        )
      );
    });

    it('migrates frozen input without changing the input or writing storage', async () => {
      const { domain: _domain, ...legacyCard } = createMockCard(State.Review, { slug: 'two-sum', paused: true });
      const card = Object.freeze(legacyCard);
      const data = Object.freeze({
        cards: Object.freeze({ 'two-sum': card }),
        notes: Object.freeze({ [card.id]: Object.freeze({ text: 'Keep this note' }) }),
        stats: Object.freeze({ historical: Object.freeze({ reviews: 2 }) }),
        settings: Object.freeze({ theme: 'dark', dayStartHour: 4 }),
        gistSync: Object.freeze({ gistId: 'saved-gist', enabled: false }),
        historicalField: Object.freeze({ value: 42 }),
      });
      const before = await fakeBrowser.storage.local.get(null);
      const migrated = migrateBackupData(data, 0);

      expect(migrated).toEqual({
        ...data,
        cards: { 'two-sum': { ...card, domain: 'leetcode.com' } },
        settings: { theme: 'dark' },
      });
      expect(migrateBackupData(data, 0)).toEqual(migrated);
      expect(data.cards['two-sum']).not.toHaveProperty('domain');
      expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
    });

    it.each([1, 2, 3])('does not reapply the domain migration to schema %s', (schemaVersion) => {
      const data = { cards: { 'two-sum': createMockCard(State.Review, { slug: 'two-sum' }) } };
      expect(migrateBackupData(data, schemaVersion)).toEqual(data);
    });

    it.each([-1, 0.5, 4])('rejects unsupported schema %s', (schemaVersion) => {
      expect(() => migrateBackupData({ cards: {} }, schemaVersion)).toThrow('Unsupported schema version');
    });

    it('repairs only falsy card domains and preserves malformed records for later validation', () => {
      const cards = {
        missing: { id: 'one', historical: true },
        empty: { domain: '' },
        nullDomain: { domain: null },
        falseDomain: { domain: false },
        zeroDomain: { domain: 0 },
        cn: { domain: 'leetcode.cn' },
        invalidDomain: { domain: 'example.com' },
        objectDomain: { domain: { historical: true } },
        arrayDomain: { domain: [] },
        booleanDomain: { domain: true },
        numberDomain: { domain: 42 },
        invalidField: { domain: 'leetcode.com', paused: 'invalid' },
        nullCard: null,
        arrayCard: [],
        primitiveCard: 'invalid',
        booleanCard: false,
        numberCard: 0,
      };
      expect(migrateBackupData({ cards, historical: 'keep' }, 0)).toEqual({
        historical: 'keep',
        cards: {
          ...cards,
          missing: { id: 'one', historical: true, domain: 'leetcode.com' },
          empty: { domain: 'leetcode.com' },
          nullDomain: { domain: 'leetcode.com' },
          falseDomain: { domain: 'leetcode.com' },
          zeroDomain: { domain: 'leetcode.com' },
        },
      });
    });

    it.each([[], 'invalid', 42])('rejects malformed historical card collections: %j', (cards) => {
      expect(() => migrateBackupData({ cards }, 0)).toThrow();
    });

    it.each([{}, { cards: null }])('preserves absent card collections: %j', (data) => {
      expect(migrateBackupData(data, 0)).toEqual(data);
    });

    it.each([4, 'invalid', null, { historical: true }])('discards retired day start values: %j', (dayStartHour) => {
      const data = { cards: { malformed: null }, settings: { dayStartHour, theme: 'unknown' }, extra: true };
      expect(migrateBackupData(data, 1)).toEqual({
        ...data,
        settings: { theme: 'unknown' },
      });
    });

    it.each([[], null, 'invalid'])('rejects malformed historical settings: %j', (settings) => {
      expect(() => migrateBackupData({ settings }, 2)).toThrow();
    });
  });

  describe('getCurrentSchemaVersion', () => {
    it('should return 0 when no version is stored', async () => {
      const version = await getCurrentSchemaVersion();
      expect(version).toBe(0);
    });

    it('should return stored version', async () => {
      await storage.setItem(STORAGE_KEYS.schemaVersion, 5);
      const version = await getCurrentSchemaVersion();
      expect(version).toBe(5);
    });
  });

  describe('setSchemaVersion', () => {
    it('should set schema version', async () => {
      await setSchemaVersion(3);
      const stored = await storage.getItem(STORAGE_KEYS.schemaVersion);
      expect(stored).toBe(3);
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
        [STORAGE_KEYS.schemaVersion.slice('local:'.length)]: 3,
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
        expect(await getCurrentSchemaVersion()).toBe(0);
        expect(writes.mock.calls.map(([key]) => key)).not.toContain(STORAGE_KEYS.schemaVersion);
      } finally {
        writes.mockRestore();
      }
    });

    it('should handle empty or missing cards storage', async () => {
      await runStartupMigrations();

      expect(await getCurrentSchemaVersion()).toBe(3);
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

      expect(await getCurrentSchemaVersion()).toBe(3);
      expect(await fakeBrowser.storage.sync.get(null)).toEqual(remainingSettings);
      expect(await fakeBrowser.storage.local.get(null)).toEqual({
        ...localBefore,
        'leetsrs:schemaVersion': 3,
      });
    });

    it('retries legacy setting removal before advancing the schema after a storage failure', async () => {
      await setSchemaVersion(2);
      await storage.setItem('sync:leetsrs:dayStartHour', 4);
      const remove = vi.spyOn(storage, 'removeItems').mockRejectedValueOnce(new Error('storage unavailable'));
      try {
        await expect(runStartupMigrations()).rejects.toThrow('Failed to run migration 3');
        expect(await getCurrentSchemaVersion()).toBe(2);
        await runStartupMigrations();
        expect(await storage.getItem('sync:leetsrs:dayStartHour')).toBeNull();
        expect(await getCurrentSchemaVersion()).toBe(3);
      } finally {
        remove.mockRestore();
      }
    });
  });

  describe('migration v2: add system theme preference', () => {
    it('upgrades version 1 to 3 while preserving learning data and unrelated settings', async () => {
      await setSchemaVersion(1);
      const card = createMockCard(State.Review, { paused: true });
      await storage.setItem(STORAGE_KEYS.cards, { [card.slug]: card });
      await storage.setItem(`${STORAGE_KEYS.notes}:${card.id}`, { text: 'Keep this note' });
      await storage.setItem(STORAGE_KEYS.stats, { '2024-03-14': { streak: 7 } });
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem('sync:leetsrs:dayStartHour', 4);
      const localBefore = await fakeBrowser.storage.local.get(null);
      const syncBefore = await fakeBrowser.storage.sync.get(null);
      const { 'leetsrs:dayStartHour': _legacy, ...remainingSettings } = syncBefore;

      await runStartupMigrations();

      expect(await getCurrentSchemaVersion()).toBe(3);
      expect(await fakeBrowser.storage.local.get(null)).toEqual({ ...localBefore, 'leetsrs:schemaVersion': 3 });
      expect(await fakeBrowser.storage.sync.get(null)).toEqual(remainingSettings);
    });
  });
});
