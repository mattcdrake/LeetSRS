import { storage } from '#imports';
import { STORAGE_KEYS } from '../storage-keys';
import { addCardDomain } from './001-add-card-domain';
import { addSystemTheme } from './002-add-system-theme';
import { removeDayStart } from './003-remove-day-start';
import { renameAutoClear } from './004-rename-auto-clear';
import type { Migration } from './migration';

// Append only: index + 1 is the schema version. Never reorder or remove entries.
const migrations = [
  addCardDomain,
  addSystemTheme,
  removeDayStart,
  renameAutoClear,
] as const satisfies readonly Migration[];
export const LATEST_SCHEMA_VERSION = migrations.length;

export async function setSchemaVersion(version: number): Promise<void> {
  await storage.setItem(STORAGE_KEYS.schemaVersion, version);
}

function validateVersion(schemaVersion: unknown, latestVersion: number): asserts schemaVersion is number {
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion < 0 ||
    schemaVersion > latestVersion
  ) {
    throw new Error(`Unsupported schema version: ${schemaVersion}`);
  }
}

export function migrateBackupData(
  data: unknown,
  schemaVersion: unknown = 0,
  steps: readonly Migration[] = migrations
): unknown {
  validateVersion(schemaVersion, steps.length);
  let migrated = data;
  for (const migration of steps.slice(schemaVersion)) {
    migrated = migration.migrate(migrated);
  }
  return migrated;
}

export async function runStartupMigrations(steps: readonly Migration[] = migrations): Promise<void> {
  // Read presence as well as value: an explicit null is malformed, not unversioned.
  const local = await storage.snapshot('local');
  const key = STORAGE_KEYS.schemaVersion.slice('local:'.length);
  const currentVersion = Object.hasOwn(local, key) ? local[key] : 0;
  validateVersion(currentVersion, steps.length);
  for (const [index, migration] of steps.slice(currentVersion).entries()) {
    const version = currentVersion + index + 1;
    try {
      const data = await migration.load();
      const migrated = migration.migrate(data);
      await migration.save(migrated);
      await migration.cleanup?.(data);
      await setSchemaVersion(version);
    } catch (error) {
      throw new Error(`Failed to run migration ${version}: ${error}`);
    }
  }
}
