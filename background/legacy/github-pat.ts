import { z } from 'zod';
import { storage } from '#imports';
import { LEGACY_PAT_KEYS } from '@/shared/legacy/github-pat';

const MIGRATION_KEY = 'local:leetsrs:oauthMigration';
const migrationSchema = z.object({ notice: z.boolean(), previousGist: z.string().nullable() });

export async function readPatMigration() {
  return migrationSchema.parse((await storage.getItem(MIGRATION_KEY)) ?? { notice: false, previousGist: null });
}

export async function migratePatConnection(): Promise<void> {
  const migrated = await storage.getItem(MIGRATION_KEY);
  if (!migrated) {
    const current = await storage.getItem<{ pat?: string; gistId?: string }>('sync:leetsrs:gistConnection');
    const pat = await storage.getItem('sync:leetsrs:githubPat');
    const gist = await storage.getItem<string>('sync:leetsrs:gistId');
    // Publish the retirement marker first; retries must never promote old credentials.
    await storage.setItem(MIGRATION_KEY, {
      notice: !!(current?.pat || current?.gistId || pat || gist),
      previousGist: current?.gistId || gist || null,
    });
  }
  await storage.removeItems([...LEGACY_PAT_KEYS]);
}

export async function dismissMigrationNotice(): Promise<void> {
  const migration = await readPatMigration();
  await storage.setItem(MIGRATION_KEY, { ...migration, notice: false });
}

export async function previousGist(): Promise<string | null> {
  return (await readPatMigration()).previousGist;
}
