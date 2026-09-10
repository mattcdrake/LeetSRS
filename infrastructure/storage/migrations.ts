import { z } from 'zod';
import { storage } from '#imports';
import { cardDomainMigration } from './migrations/001-card-domain';
import { systemThemeMigration } from './migrations/002-system-theme';
import { removeDayStartMigration } from './migrations/003-remove-day-start';
import type { Migration } from './migrations/contract';
import { STORAGE_KEYS } from './storage-keys';

export type { Migration } from './migrations/contract';

// Append only: index + 1 is the schema version. Never reorder or remove entries.
const migrations: readonly Migration[] = [cardDomainMigration, systemThemeMigration, removeDayStartMigration];
export const LATEST_SCHEMA_VERSION = migrations.length;

const snapshotSchema = z.object({
  version: z.number().int().positive(),
  input: z.unknown().refine(isJsonInput, 'Migration input must be lossless JSON data'),
});

// Visit every own JSON key. Schema parsers may skip __proto__, losing data or overlooking invalid values.
function isJsonInput(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  const properties = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value)) {
    return (
      Reflect.ownKeys(value).length === value.length + 1 &&
      Array.from({ length: value.length }, (_, index) => properties[index]).every(
        (property) => property !== undefined && 'value' in property && isJsonInput(property.value)
      )
    );
  }
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.getOwnPropertySymbols(value).length === 0 &&
    Object.values(properties).every(
      (property) => property.enumerable && 'value' in property && isJsonInput(property.value)
    )
  );
}

function checkVersion(version: number, latest: number): void {
  if (!Number.isInteger(version) || version < 0 || version > latest) {
    throw new Error(`Unsupported schema version: ${version}. Please update the extension before retrying.`);
  }
}

export async function getCurrentSchemaVersion(): Promise<number> {
  return (await storage.getItem<number>(STORAGE_KEYS.schemaVersion)) ?? 0;
}

export async function setSchemaVersion(version: number): Promise<void> {
  await storage.setItem(STORAGE_KEYS.schemaVersion, version);
}

export function migrateBackupData(
  data: unknown,
  schemaVersion: number,
  steps: readonly Migration[] = migrations
): unknown {
  checkVersion(schemaVersion, steps.length);
  let migrated = data;
  for (const migration of steps.slice(schemaVersion)) {
    migrated = migration.migrate(migrated);
  }
  return migrated;
}

export async function runStartupMigrations(steps: readonly Migration[] = migrations): Promise<void> {
  let phase = 'read recovery metadata';
  let step = 'startup recovery';
  try {
    const currentVersion = await getCurrentSchemaVersion();
    checkVersion(currentVersion, steps.length);
    const saved = await storage.getItem<unknown>(STORAGE_KEYS.migrationSnapshot);
    let snapshot: z.infer<typeof snapshotSchema> | undefined;
    if (saved !== null) {
      const parsed = snapshotSchema.safeParse(saved);
      if (
        !parsed.success ||
        parsed.data.version > steps.length ||
        (parsed.data.version !== currentVersion && parsed.data.version !== currentVersion + 1)
      ) {
        throw new Error(
          'Inconsistent migration recovery metadata. Preserve the snapshot and restore compatible recovery metadata before retrying.'
        );
      }
      snapshot = parsed.data;
      if (snapshot.version === currentVersion) {
        // Destination writes, cleanup, and version advancement already succeeded.
        phase = 'retire recovery snapshot';
        await storage.removeItem(STORAGE_KEYS.migrationSnapshot);
        snapshot = undefined;
      }
    }
    for (const [index, migration] of steps.slice(currentVersion).entries()) {
      const version = currentVersion + index + 1;
      step = `migration ${version} (${migration.description})`;
      phase = 'load original input';
      if (!snapshot) {
        const input = await migration.load();
        phase = 'save recovery snapshot';
        snapshot = snapshotSchema.parse({ version, input });
        await storage.setItem(STORAGE_KEYS.migrationSnapshot, snapshot);
      }
      phase = 'transform and validate';
      const migrated = migration.migrate(snapshot.input);
      phase = 'save destination';
      await migration.save(migrated);
      phase = 'clean obsolete sources';
      await migration.cleanup?.(snapshot.input);
      phase = 'record completed version';
      await setSchemaVersion(version);
      phase = 'retire recovery snapshot';
      await storage.removeItem(STORAGE_KEYS.migrationSnapshot);
      snapshot = undefined;
    }
  } catch (error) {
    throw new Error(
      `Failed to run ${step} during ${phase}: ${error}. ` +
        'Startup is blocked. Resolve the error and reload the extension to retry; keep any saved recovery snapshot.',
      { cause: error }
    );
  }
}
