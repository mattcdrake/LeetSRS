import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';

// Fields the migrations currently touch; other backup fields pass through unchanged.
// Cards may be absent in storage, and legacy records have not yet been validated.
interface MigrationData {
  cards?: Record<string, unknown>;
}

export interface Migration {
  version: number;
  description: string;
  migrate: (data: MigrationData) => MigrationData;
}

export async function getCurrentSchemaVersion(): Promise<number> {
  return (await storage.getItem<number>(STORAGE_KEYS.schemaVersion)) ?? 0;
}

export async function setSchemaVersion(version: number): Promise<void> {
  await storage.setItem(STORAGE_KEYS.schemaVersion, version);
}

const migrations: Migration[] = [
  {
    version: 1,
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
    version: 2,
    description: 'Add system theme preference',
    migrate: (data: MigrationData): MigrationData => data,
  },
];

const supportedSchemaVersion = Math.max(0, ...migrations.map(({ version }) => version));

function pendingMigrations(steps: readonly Migration[], schemaVersion: number): Migration[] {
  const seenVersions = new Set<number>();
  for (const step of steps) {
    if (seenVersions.has(step.version)) {
      throw new Error(`Duplicate migration version detected: ${step.version}`);
    }
    seenVersions.add(step.version);
  }
  return steps.filter(({ version }) => version > schemaVersion).sort((a, b) => a.version - b.version);
}

export function migrateBackupData<T extends MigrationData>(data: T, schemaVersion: number): T {
  if (!Number.isInteger(schemaVersion) || schemaVersion < 0 || schemaVersion > supportedSchemaVersion) {
    throw new Error(`Unsupported schema version: ${schemaVersion}`);
  }
  let migrated = data;
  for (const migration of pendingMigrations(migrations, schemaVersion)) {
    migrated = { ...migrated, ...migration.migrate(migrated) };
  }
  return migrated;
}

export async function runStartupMigrations(steps: readonly Migration[] = migrations): Promise<void> {
  const currentVersion = await getCurrentSchemaVersion();
  for (const migration of pendingMigrations(steps, currentVersion)) {
    try {
      const cards = await storage.getItem<Record<string, unknown>>(STORAGE_KEYS.cards);
      const data = { cards: cards ?? undefined };
      const migrated = migration.migrate(data);
      if (migrated.cards !== undefined) {
        await storage.setItem(STORAGE_KEYS.cards, migrated.cards);
      }
      await setSchemaVersion(migration.version);
    } catch (error) {
      throw new Error(`Failed to run migration ${migration.version}: ${error}`);
    }
  }
}
