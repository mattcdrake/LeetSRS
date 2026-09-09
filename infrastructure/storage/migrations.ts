import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';

// Fields the migrations currently touch; other backup fields pass through unchanged.
// Cards may be absent in storage, and legacy records have not yet been validated.
interface MigrationData {
  cards?: Record<string, unknown>;
}

export interface Migration {
  description: string;
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
];

export function migrateBackupData<T extends MigrationData>(data: T, schemaVersion: number): T {
  if (!Number.isInteger(schemaVersion) || schemaVersion < 0 || schemaVersion > migrations.length) {
    throw new Error(`Unsupported schema version: ${schemaVersion}`);
  }
  let migrated = data;
  for (const migration of migrations.slice(schemaVersion)) {
    migrated = { ...migrated, ...migration.migrate(migrated) };
  }
  return migrated;
}

export async function runStartupMigrations(steps: readonly Migration[] = migrations): Promise<void> {
  const currentVersion = await getCurrentSchemaVersion();
  for (const [index, migration] of steps.slice(currentVersion).entries()) {
    const version = currentVersion + index + 1;
    try {
      const cards = await storage.getItem<Record<string, unknown>>(STORAGE_KEYS.cards);
      const data = { cards: cards ?? undefined };
      const migrated = migration.migrate(data);
      if (migrated.cards !== undefined) {
        await storage.setItem(STORAGE_KEYS.cards, migrated.cards);
      }
      await setSchemaVersion(version);
    } catch (error) {
      throw new Error(`Failed to run migration ${version}: ${error}`);
    }
  }
}
