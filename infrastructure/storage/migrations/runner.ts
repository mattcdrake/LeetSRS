import { storage } from '#imports';
import { STORAGE_KEYS } from '../storage-keys';
import { addCardDomain } from './001-add-card-domain';
import { addSystemTheme } from './002-add-system-theme';
import { removeDayStart } from './003-remove-day-start';
import { readMigrationData, writeMigrationData } from './persistence';

// Append only: index + 1 is the schema version. Never reorder or remove entries.
const migrations = [addCardDomain, addSystemTheme, removeDayStart] as const;
export const LATEST_SCHEMA_VERSION = migrations.length;

export async function getCurrentSchemaVersion(): Promise<number> {
  return (await storage.getItem<number>(STORAGE_KEYS.schemaVersion)) ?? 0;
}

export async function setSchemaVersion(version: number): Promise<void> {
  await storage.setItem(STORAGE_KEYS.schemaVersion, version);
}

export function migrateBackupData(data: unknown, schemaVersion: unknown = 0): unknown {
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion < 0 ||
    schemaVersion > LATEST_SCHEMA_VERSION
  ) {
    throw new Error(`Unsupported schema version: ${schemaVersion}`);
  }
  let migrated = data;
  for (const migration of migrations.slice(schemaVersion)) {
    migrated = migration.migrate(migrated);
  }
  return migrated;
}

export async function runStartupMigrations(): Promise<void> {
  const currentVersion = await getCurrentSchemaVersion();
  for (const [index, migration] of migrations.slice(currentVersion).entries()) {
    const version = currentVersion + index + 1;
    try {
      const data = await readMigrationData();
      const migrated = migration.migrate(data);
      await writeMigrationData(data, migrated);
      await setSchemaVersion(version);
    } catch (error) {
      throw new Error(`Failed to run migration ${version}: ${error}`);
    }
  }
}
