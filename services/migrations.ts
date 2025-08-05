import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';

export interface Migration {
  version: number;
  description: string;
  migrate: () => Promise<void>;
}

const SCHEMA_VERSION_KEY = STORAGE_KEYS.schemaVersion;

export async function getCurrentSchemaVersion(): Promise<number> {
  const version = await storage.getItem<number>(SCHEMA_VERSION_KEY);
  return version ?? 0;
}

export async function setSchemaVersion(version: number): Promise<void> {
  await storage.setItem(SCHEMA_VERSION_KEY, version);
}

export async function runMigrations(migrations: Migration[]): Promise<void> {
  // Check for duplicate version numbers
  const seenVersions = new Set<number>();
  for (const migration of migrations) {
    if (seenVersions.has(migration.version)) {
      throw new Error(`Duplicate migration version detected: ${migration.version}`);
    }
    seenVersions.add(migration.version);
  }

  const currentVersion = await getCurrentSchemaVersion();
  const sortedMigrations = [...migrations].sort((a, b) => a.version - b.version);

  for (const migration of sortedMigrations) {
    if (migration.version > currentVersion) {
      console.log(`Running migration ${migration.version}: ${migration.description}`);
      try {
        await migration.migrate();
        await setSchemaVersion(migration.version);
        console.log(`Migration ${migration.version} completed successfully`);
      } catch (error) {
        console.error(`Migration ${migration.version} failed:`, error);
        throw new Error(`Failed to run migration ${migration.version}: ${error}`);
      }
    }
  }
}

export const migrations: Migration[] = [
  // Example migration (version 1):
  // {
  //   version: 1,
  //   description: 'Add difficulty field to cards',
  //   migrate: async () => {
  //     const cards = await storage.getItem<Record<string, any>>(STORAGE_KEYS.cards);
  //     if (cards) {
  //       for (const cardId in cards) {
  //         if (!cards[cardId].difficulty) {
  //           cards[cardId].difficulty = 'medium';
  //         }
  //       }
  //       await storage.setItem(STORAGE_KEYS.cards, cards);
  //     }
  //   }
  // }
];
