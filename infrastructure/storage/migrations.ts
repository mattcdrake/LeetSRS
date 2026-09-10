import type { StorageItemKey } from 'wxt/utils/storage';
import { storage } from '#imports';
import { noteSchema } from '@/domain/notes';
import { STORAGE_KEYS } from './storage-keys';

// Cards may be absent in storage, and legacy records have not yet been validated.
interface MigrationData {
  cards?: Record<string, unknown>;
  notes?: Record<string, unknown>;
}

export interface Migration {
  description: string;
  migrateStorage?: () => Promise<void>;
  removeKeys?: readonly StorageItemKey[];
  migrate: (data: MigrationData) => MigrationData;
}

export async function getCurrentSchemaVersion(): Promise<number> {
  return (await storage.getItem<number>(STORAGE_KEYS.schemaVersion)) ?? 0;
}

export async function setSchemaVersion(version: number): Promise<void> {
  await storage.setItem(STORAGE_KEYS.schemaVersion, version);
}

// Append only: index + 1 is the schema version. Never reorder or remove entries.
const migrations: readonly Migration[] = [
  {
    description: 'Add domain field to existing cards, defaulting to leetcode.com',
    migrate: (data: MigrationData): MigrationData => {
      if (!data.cards) return data;
      const cards = Object.fromEntries(
        Object.entries(data.cards).map(([slug, card]) => {
          // Leave malformed records for record validation after migration.
          if (typeof card !== 'object' || card === null || Array.isArray(card)) return [slug, card];
          if ('domain' in card && card.domain) return [slug, card];
          return [slug, { ...card, domain: 'leetcode.com' }];
        })
      );
      return { ...data, cards };
    },
  },
  {
    description: 'Add system theme preference',
    migrate: (data: MigrationData): MigrationData => data,
  },
  {
    description: 'Remove configurable day start',
    migrate: (data: MigrationData): MigrationData => data,
    removeKeys: ['sync:leetsrs:dayStartHour'],
  },
  {
    description: 'Embed notes in their owning cards',
    migrate: embedNotes,
    migrateStorage: async () => {
      const snapshot = await storage.snapshot('local');
      const noteKeys = Object.keys(snapshot).filter((key) => key.startsWith('leetsrs:notes:'));
      const cards = await storage.getItem<Record<string, unknown>>(STORAGE_KEYS.cards);
      const migrated = embedNotes({
        cards: cards ?? undefined,
        notes: Object.fromEntries(noteKeys.map((key) => [key.slice('leetsrs:notes:'.length), snapshot[key]])),
      });
      // Keep legacy notes until their owners are saved. Retrying after cleanup
      // preserves embedded notes even when some or all legacy keys are gone.
      if (migrated.cards !== undefined) await storage.setItem(STORAGE_KEYS.cards, migrated.cards);
      await storage.removeItems([...noteKeys.map((key): StorageItemKey => `local:${key}`), 'local:leetsrs:notes']);
    },
  },
];

export const CURRENT_SCHEMA_VERSION = migrations.length;

function embedNotes(data: MigrationData): MigrationData {
  if (!data.cards) return data;
  const cards = Object.fromEntries(
    Object.entries(data.cards).map(([slug, card]) => {
      if (typeof card !== 'object' || card === null || Array.isArray(card)) return [slug, card];
      if ('note' in card || !('id' in card) || typeof card.id !== 'string') return [slug, card];
      const note = data.notes && Object.hasOwn(data.notes, card.id) ? data.notes[card.id] : undefined;
      return [slug, note == null ? card : { ...card, note: noteSchema.parse(note).text }];
    })
  );
  return { cards };
}

export function migrateBackupData(data: MigrationData, schemaVersion: number): MigrationData {
  if (!Number.isInteger(schemaVersion) || schemaVersion < 0 || schemaVersion > migrations.length) {
    throw new Error(`Unsupported schema version: ${schemaVersion}`);
  }
  let migrated = data;
  for (const migration of migrations.slice(schemaVersion)) {
    migrated = migration.migrate(migrated);
  }
  return migrated;
}

export async function runStartupMigrations(steps: readonly Migration[] = migrations): Promise<void> {
  const currentVersion = await getCurrentSchemaVersion();
  for (const [index, migration] of steps.slice(currentVersion).entries()) {
    const version = currentVersion + index + 1;
    try {
      if (migration.migrateStorage) {
        await migration.migrateStorage();
      } else {
        const cards = await storage.getItem<Record<string, unknown>>(STORAGE_KEYS.cards);
        const data = { cards: cards ?? undefined };
        const migrated = migration.migrate(data);
        if (migrated.cards !== undefined) {
          await storage.setItem(STORAGE_KEYS.cards, migrated.cards);
        }
        if (migration.removeKeys) {
          await storage.removeItems([...migration.removeKeys]);
        }
      }
      await setSchemaVersion(version);
    } catch (error) {
      throw new Error(`Failed to run migration ${version}: ${error}`);
    }
  }
}
