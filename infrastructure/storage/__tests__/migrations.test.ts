import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { createMockCard } from '@/test/utils/card-mocks';
import { getAllCards } from '../cards';
import {
  getCurrentSchemaVersion,
  type Migration,
  migrateBackupData,
  runStartupMigrations,
  setSchemaVersion,
} from '../migrations';
import { STORAGE_KEYS } from '../storage-keys';

describe('migrations', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('migrateBackupData', () => {
    it('migrates frozen input without changing the input or writing storage', async () => {
      const { domain: _domain, ...legacyCard } = createMockCard(State.Review, { slug: 'two-sum', paused: true });
      const card = Object.freeze(legacyCard);
      const data = Object.freeze({
        cards: Object.freeze({ 'two-sum': card }),
      });
      const before = await fakeBrowser.storage.local.get(null);
      const migrated = migrateBackupData(data, 0);

      expect(migrated).toEqual({
        ...data,
        cards: { 'two-sum': { ...card, domain: 'leetcode.com' } },
      });
      expect(data.cards['two-sum']).not.toHaveProperty('domain');
      expect(await fakeBrowser.storage.local.get(null)).toEqual(before);
    });

    it.each([1, 2, 3])('does not reapply the domain migration to schema %s', (schemaVersion) => {
      const data = { cards: { 'two-sum': createMockCard(State.Review, { slug: 'two-sum' }) } };
      expect(migrateBackupData(data, schemaVersion)).toEqual(data);
    });

    it.each([-1, 0.5, 5])('rejects unsupported schema %s', (schemaVersion) => {
      expect(() => migrateBackupData({ cards: {} }, schemaVersion)).toThrow('Unsupported schema version');
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

  describe('runStartupMigrations', () => {
    it('runs migrations in array order', async () => {
      const executionOrder: string[] = [];
      const steps: Migration[] = ['add domain', 'add theme', 'next migration'].map((description) => ({
        description,
        migrate: (data) => {
          executionOrder.push(description);
          return data;
        },
      }));

      await runStartupMigrations(steps);

      expect(executionOrder).toEqual(['add domain', 'add theme', 'next migration']);
      expect(await getCurrentSchemaVersion()).toBe(3);
    });

    it('should only run migrations newer than current version', async () => {
      await setSchemaVersion(2);

      const executionOrder: number[] = [];
      const migrations: Migration[] = [
        {
          description: 'Old migration',
          migrate: (data) => {
            executionOrder.push(1);
            return data;
          },
        },
        {
          description: 'Current migration',
          migrate: (data) => {
            executionOrder.push(2);
            return data;
          },
        },
        {
          description: 'New migration',
          migrate: (data) => {
            executionOrder.push(3);
            return data;
          },
        },
        {
          description: 'Newer migration',
          migrate: (data) => {
            executionOrder.push(4);
            return data;
          },
        },
      ];

      await runStartupMigrations(migrations);

      expect(executionOrder).toEqual([3, 4]);
      expect(await getCurrentSchemaVersion()).toBe(4);
    });

    it('should handle empty migrations array', async () => {
      await runStartupMigrations([]);
      expect(await getCurrentSchemaVersion()).toBe(0);
    });

    it('derives persisted versions from array positions after skipping completed steps', async () => {
      await setSchemaVersion(1);
      const step: Migration = { description: 'No-op', migrate: (data) => data };
      const writes = vi.spyOn(storage, 'setItem');
      try {
        await runStartupMigrations([step, step, step]);

        expect(writes.mock.calls.filter(([key]) => key === STORAGE_KEYS.schemaVersion)).toEqual([
          [STORAGE_KEYS.schemaVersion, 2],
          [STORAGE_KEYS.schemaVersion, 3],
        ]);
        expect(await getCurrentSchemaVersion()).toBe(3);
      } finally {
        writes.mockRestore();
      }
    });

    it('should stop and throw error if migration fails', async () => {
      const executionOrder: number[] = [];

      const migrations: Migration[] = [
        {
          description: 'Success migration',
          migrate: (data) => {
            executionOrder.push(1);
            return data;
          },
        },
        {
          description: 'Failing migration',
          migrate: () => {
            executionOrder.push(2);
            throw new Error('Migration failed');
          },
        },
        {
          description: 'Should not run',
          migrate: (data) => {
            executionOrder.push(3);
            return data;
          },
        },
      ];

      await expect(runStartupMigrations(migrations)).rejects.toThrow('Failed to run migration 2');

      expect(executionOrder).toEqual([1, 2]);
      expect(await getCurrentSchemaVersion()).toBe(1); // Only first migration succeeded
    });

    it('persists each step before advancing its version and starting the next step', async () => {
      const versions: number[] = [];
      const first = createMockCard(State.New, { slug: 'first' });
      const second = createMockCard(State.New, { slug: 'second' });
      const steps: Migration[] = [
        {
          description: 'First',
          migrate: () => ({ cards: { first } }),
        },
        {
          description: 'Second',
          migrate: (data) => {
            expect(data.cards).toEqual({ first });
            return { cards: { ...data.cards, second } };
          },
        },
      ];
      const write = storage.setItem.bind(storage);
      const writes = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
        if (key === STORAGE_KEYS.cards) versions.push(await getCurrentSchemaVersion());
        return write(key, value);
      });
      try {
        await runStartupMigrations(steps);

        expect(versions).toEqual([0, 1]);
        expect(writes.mock.calls.map(([key]) => key)).toEqual([
          STORAGE_KEYS.cards,
          STORAGE_KEYS.schemaVersion,
          STORAGE_KEYS.cards,
          STORAGE_KEYS.schemaVersion,
        ]);
        expect(await getCurrentSchemaVersion()).toBe(2);
      } finally {
        writes.mockRestore();
      }
    });
  });

  describe('migration v4: embed notes', () => {
    it.each(['cards', 'cleanup', 'version', 'none'])(
      'preserves configured learning data and retries after %s failure',
      async (failure) => {
        await setSchemaVersion(3);
        const card = createMockCard(State.Review, { id: 'owner', slug: 'two-sum', paused: true });
        const empty = createMockCard(State.Learning, { id: 'empty', slug: 'empty', domain: 'leetcode.cn' });
        const absent = createMockCard(State.New, { id: 'absent', slug: 'absent' });
        await storage.setItem(STORAGE_KEYS.cards, { 'two-sum': card, empty, absent });
        await storage.setItem('local:leetsrs:notes:owner', { text: 'Keep the full schedule' });
        await storage.setItem('local:leetsrs:notes:empty', { text: '' });
        await storage.setItem('local:leetsrs:notes:orphan', { text: 'Obsolete' });
        await storage.setItem(STORAGE_KEYS.theme, 'dark');
        await storage.setItem(STORAGE_KEYS.gistId, 'configured-gist');
        await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-01T00:00:00.000Z');
        const settings = await fakeBrowser.storage.sync.get(null);
        const write = storage.setItem.bind(storage);
        const writes = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
          if (
            (failure === 'cards' && key === STORAGE_KEYS.cards) ||
            (failure === 'version' && key === STORAGE_KEYS.schemaVersion)
          )
            throw new Error('write failed');
          await write(key, value);
        });
        const cleanup = vi.spyOn(storage, 'removeItems');
        if (failure === 'cleanup') cleanup.mockRejectedValueOnce(new Error('cleanup failed'));
        try {
          if (failure !== 'none') {
            await expect(runStartupMigrations()).rejects.toThrow('Failed to run migration 4');
            expect(await getCurrentSchemaVersion()).toBe(3);
          }
        } finally {
          writes.mockRestore();
          cleanup.mockRestore();
        }
        await runStartupMigrations();
        await runStartupMigrations();
        expect(await getAllCards()).toEqual([
          { ...card, note: 'Keep the full schedule' },
          { ...empty, note: '' },
          absent,
        ]);
        expect(await getCurrentSchemaVersion()).toBe(4);
        expect(await fakeBrowser.storage.sync.get(null)).toEqual(settings);
        expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe('2024-01-01T00:00:00.000Z');
        expect(
          Object.keys(await fakeBrowser.storage.local.get(null)).filter((key) => key.startsWith('leetsrs:notes'))
        ).toEqual([]);
      }
    );
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
      await storage.setItem(`local:leetsrs:notes:legacy-id`, { text: 'Keep this note' });
      await storage.setItem(`local:leetsrs:notes:cn-id`, { text: 'Keep this too' });
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-01T00:00:00.000Z');
      const before = await fakeBrowser.storage.local.get(null);

      await runStartupMigrations();

      expect(await getAllCards()).toEqual([
        { ...legacyCard, domain: 'leetcode.com', note: 'Keep this note' },
        { ...cards['add-two-numbers'], note: 'Keep this too' },
      ]);
      expect(await fakeBrowser.storage.local.get(null)).toEqual({
        [STORAGE_KEYS.dataUpdatedAt.slice('local:'.length)]: before['leetsrs:dataUpdatedAt'],
        [STORAGE_KEYS.cards.slice('local:'.length)]: {
          'two-sum': { ...cards['two-sum'], domain: 'leetcode.com', note: 'Keep this note' },
          'add-two-numbers': { ...cards['add-two-numbers'], note: 'Keep this too' },
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
        expect(await getCurrentSchemaVersion()).toBe(0);
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
      await storage.setItem(`local:leetsrs:notes:legacy-id`, { text: 'Keep this note' });
      await storage.setItem(`local:leetsrs:notes:cn-id`, { text: 'Keep this too' });
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
        expect(await getCurrentSchemaVersion()).toBe(0);
        expect(await fakeBrowser.storage.local.get(null)).toEqual(expectedAfterCardWrite);
      } finally {
        writes.mockRestore();
      }

      // A new startup sees the persisted cards and the old schema version.
      await runStartupMigrations();

      expect(await fakeBrowser.storage.local.get(null)).toEqual({
        'leetsrs:dataUpdatedAt': before['leetsrs:dataUpdatedAt'],
        'leetsrs:cards': {
          'two-sum': { ...cards['two-sum'], domain: 'leetcode.com', note: 'Keep this note' },
          'add-two-numbers': { ...cards['add-two-numbers'], note: 'Keep this too' },
        },
        [STORAGE_KEYS.schemaVersion.slice('local:'.length)]: 4,
      });
    });

    it('should handle empty or missing cards storage', async () => {
      await runStartupMigrations();

      expect(await getCurrentSchemaVersion()).toBe(4);
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

      expect(await getCurrentSchemaVersion()).toBe(4);
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
        expect(await getCurrentSchemaVersion()).toBe(2);
        await runStartupMigrations();
        expect(await storage.getItem('sync:leetsrs:dayStartHour')).toBeNull();
        expect(await getCurrentSchemaVersion()).toBe(4);
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

      expect(await getCurrentSchemaVersion()).toBe(4);
      expect(await storage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    });
  });
});
