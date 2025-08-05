import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from 'wxt/utils/storage';
import { getCurrentSchemaVersion, setSchemaVersion, runMigrations, type Migration } from '../migrations';
import { STORAGE_KEYS } from '../storage-keys';

describe('migrations', () => {
  beforeEach(() => {
    fakeBrowser.reset();
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

  describe('runMigrations', () => {
    it('should run migrations in order', async () => {
      const executionOrder: number[] = [];

      const migrations: Migration[] = [
        {
          version: 3,
          description: 'Third migration',
          migrate: async () => {
            executionOrder.push(3);
          },
        },
        {
          version: 1,
          description: 'First migration',
          migrate: async () => {
            executionOrder.push(1);
          },
        },
        {
          version: 2,
          description: 'Second migration',
          migrate: async () => {
            executionOrder.push(2);
          },
        },
      ];

      await runMigrations(migrations);

      expect(executionOrder).toEqual([1, 2, 3]);
      expect(await getCurrentSchemaVersion()).toBe(3);
    });

    it('should only run migrations newer than current version', async () => {
      await setSchemaVersion(2);

      const executionOrder: number[] = [];
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Old migration',
          migrate: async () => {
            executionOrder.push(1);
          },
        },
        {
          version: 2,
          description: 'Current migration',
          migrate: async () => {
            executionOrder.push(2);
          },
        },
        {
          version: 3,
          description: 'New migration',
          migrate: async () => {
            executionOrder.push(3);
          },
        },
        {
          version: 4,
          description: 'Newer migration',
          migrate: async () => {
            executionOrder.push(4);
          },
        },
      ];

      await runMigrations(migrations);

      expect(executionOrder).toEqual([3, 4]);
      expect(await getCurrentSchemaVersion()).toBe(4);
    });

    it('should handle empty migrations array', async () => {
      await runMigrations([]);
      expect(await getCurrentSchemaVersion()).toBe(0);
    });

    it('should throw error for duplicate migration versions', async () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'First migration',
          migrate: async () => {},
        },
        {
          version: 2,
          description: 'Second migration',
          migrate: async () => {},
        },
        {
          version: 1,
          description: 'Duplicate version',
          migrate: async () => {},
        },
      ];

      await expect(runMigrations(migrations)).rejects.toThrow('Duplicate migration version detected: 1');
    });

    it('should stop and throw error if migration fails', async () => {
      const executionOrder: number[] = [];

      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Success migration',
          migrate: async () => {
            executionOrder.push(1);
          },
        },
        {
          version: 2,
          description: 'Failing migration',
          migrate: async () => {
            executionOrder.push(2);
            throw new Error('Migration failed');
          },
        },
        {
          version: 3,
          description: 'Should not run',
          migrate: async () => {
            executionOrder.push(3);
          },
        },
      ];

      await expect(runMigrations(migrations)).rejects.toThrow('Failed to run migration 2');

      expect(executionOrder).toEqual([1, 2]);
      expect(await getCurrentSchemaVersion()).toBe(1); // Only first migration succeeded
    });

    it('should update version after each successful migration', async () => {
      const versions: number[] = [];

      const migrations: Migration[] = [
        {
          version: 1,
          description: 'First',
          migrate: async () => {
            // Version should still be 0 during first migration
            versions.push(await getCurrentSchemaVersion());
          },
        },
        {
          version: 2,
          description: 'Second',
          migrate: async () => {
            // Version should be 1 during second migration
            versions.push(await getCurrentSchemaVersion());
          },
        },
      ];

      await runMigrations(migrations);

      expect(versions).toEqual([0, 1]);
      expect(await getCurrentSchemaVersion()).toBe(2);
    });
  });
});
