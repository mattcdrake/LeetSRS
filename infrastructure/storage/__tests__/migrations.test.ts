import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { requireDefined } from '@/test/utils/assertions';
import { createMockCard } from '@/test/utils/card-mocks';
import { serializeCard } from '../cards/codec';
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
      const card = Object.freeze({ id: 'legacy-id', paused: true });
      const data = Object.freeze({
        cards: Object.freeze({ 'two-sum': card }),
        notes: { 'legacy-id': { text: 'Keep this note' } },
        settings: { theme: 'dark' },
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

    it.each([1, 2])('does not reapply the domain migration to schema %s', (schemaVersion) => {
      const data = { cards: { 'two-sum': { id: 'existing-id' } }, settings: { theme: 'dark' } };
      expect(migrateBackupData(data, schemaVersion)).toEqual(data);
    });

    it.each([-1, 0.5, 3])('rejects unsupported schema %s', (schemaVersion) => {
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
      const steps: Migration[] = [
        {
          description: 'First',
          migrate: (data) => ({ ...data, cards: { first: { id: 'first' } } }),
        },
        {
          description: 'Second',
          migrate: (data) => {
            expect(data.cards).toEqual({ first: { id: 'first' } });
            return { ...data, cards: { ...data.cards, second: { id: 'second' } } };
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

  describe('migration v1: add domain to cards', () => {
    it('changes only missing domains while preserving schedules, pause state, notes, and unrelated storage', async () => {
      const { domain: _domain, ...legacyCard } = serializeCard(
        createMockCard(State.Review, { id: 'legacy-id', slug: 'two-sum', paused: true })
      );
      const cards = {
        'two-sum': { ...legacyCard, legacyMetadata: { source: 'manual' } },
        'add-two-numbers': serializeCard(
          createMockCard(State.Learning, { id: 'cn-id', slug: 'add-two-numbers', domain: 'leetcode.cn' })
        ),
      };
      await storage.setItem(STORAGE_KEYS.cards, cards);
      await storage.setItem(`${STORAGE_KEYS.notes}:legacy-id`, { text: 'Keep this note' });
      await storage.setItem(`${STORAGE_KEYS.notes}:cn-id`, { text: 'Keep this too' });
      await storage.setItem(STORAGE_KEYS.theme, 'dark');
      await storage.setItem(STORAGE_KEYS.dataUpdatedAt, '2024-01-01T00:00:00.000Z');
      const before = await fakeBrowser.storage.local.get(null);

      await runStartupMigrations();

      expect(await fakeBrowser.storage.local.get(null)).toEqual({
        ...before,
        [STORAGE_KEYS.cards.slice('local:'.length)]: {
          ...cards,
          'two-sum': { ...cards['two-sum'], domain: 'leetcode.com' },
        },
        [STORAGE_KEYS.schemaVersion.slice('local:'.length)]: 2,
      });
    });

    it('does not advance the schema when migrated cards cannot be persisted', async () => {
      const cards = { 'two-sum': { slug: 'two-sum' } };
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
      const { domain: _domain, ...legacyCard } = serializeCard(
        createMockCard(State.Review, { id: 'legacy-id', slug: 'two-sum', paused: true })
      );
      const cards = {
        'two-sum': { ...legacyCard, legacyMetadata: { source: 'manual' } },
        'add-two-numbers': serializeCard(
          createMockCard(State.Learning, { id: 'cn-id', slug: 'add-two-numbers', domain: 'leetcode.cn' })
        ),
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
        expect(await getCurrentSchemaVersion()).toBe(0);
        expect(await fakeBrowser.storage.local.get(null)).toEqual(expectedAfterCardWrite);
      } finally {
        writes.mockRestore();
      }

      // A new startup sees the persisted cards and the old schema version.
      await runStartupMigrations();

      expect(await fakeBrowser.storage.local.get(null)).toEqual({
        ...expectedAfterCardWrite,
        [STORAGE_KEYS.schemaVersion.slice('local:'.length)]: 2,
      });
    });

    it('should add domain to cards that are missing it', async () => {
      // Set up cards without domain field (pre-migration state)
      await storage.setItem(STORAGE_KEYS.cards, {
        'two-sum': { slug: 'two-sum', name: 'Two Sum' },
        'add-two-numbers': { slug: 'add-two-numbers', name: 'Add Two Numbers' },
      });

      await runStartupMigrations();

      const cards = await storage.getItem<Record<string, { domain?: string }>>(STORAGE_KEYS.cards);
      expect(requireDefined(cards)['two-sum'].domain).toBe('leetcode.com');
      expect(requireDefined(cards)['add-two-numbers'].domain).toBe('leetcode.com');
    });

    it('should not overwrite existing domain values', async () => {
      await storage.setItem(STORAGE_KEYS.cards, {
        'two-sum': { slug: 'two-sum', domain: 'leetcode.cn' },
      });

      await runStartupMigrations();

      const cards = await storage.getItem<Record<string, { domain?: string }>>(STORAGE_KEYS.cards);
      expect(requireDefined(cards)['two-sum'].domain).toBe('leetcode.cn');
    });

    it('should handle empty or missing cards storage', async () => {
      await runStartupMigrations();

      expect(await getCurrentSchemaVersion()).toBe(2);
    });
  });

  describe('migration v2: add system theme preference', () => {
    it('should advance the schema without changing an existing theme', async () => {
      await setSchemaVersion(1);
      await storage.setItem(STORAGE_KEYS.theme, 'dark');

      await runStartupMigrations();

      expect(await getCurrentSchemaVersion()).toBe(2);
      expect(await storage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    });
  });
});
