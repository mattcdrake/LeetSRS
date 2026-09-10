import { storage } from '#imports';
import { addCardDomainMigration } from './migrations/001-add-card-domain';
import { addSystemThemeMigration } from './migrations/002-add-system-theme';
import { removeDayStartMigration } from './migrations/003-remove-day-start';
import type { Migration, MigrationData } from './migrations/types';
import { STORAGE_KEYS } from './storage-keys';

export type { Migration } from './migrations/types';

export async function getCurrentSchemaVersion(): Promise<number> {
  return (await storage.getItem<number>(STORAGE_KEYS.schemaVersion)) ?? 0;
}

export async function setSchemaVersion(version: number): Promise<void> {
  await storage.setItem(STORAGE_KEYS.schemaVersion, version);
}

// Append only: index + 1 is the schema version. Never reorder or remove entries.
const migrations: readonly Migration[] = [addCardDomainMigration, addSystemThemeMigration, removeDayStartMigration];

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
      const cards = await storage.getItem<Record<string, unknown>>(STORAGE_KEYS.cards);
      const data = { cards: cards ?? undefined };
      const migrated = migration.migrate(data);
      if (migrated.cards !== undefined) {
        await storage.setItem(STORAGE_KEYS.cards, migrated.cards);
      }
      if (migration.removeKeys) {
        await storage.removeItems([...migration.removeKeys]);
      }
      await setSchemaVersion(version);
    } catch (error) {
      throw new Error(`Failed to run migration ${version}: ${error}`);
    }
  }
}
