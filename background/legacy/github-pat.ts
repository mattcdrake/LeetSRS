import { z } from 'zod';
import { storage } from '#imports';
import { LEGACY_PAT_KEYS, patMigrationItem } from '@/shared/legacy/github-pat';

const migrationSchema = z.object({ notice: z.boolean(), previousGist: z.string().nullable() });

export async function readPatMigration() {
  return migrationSchema.parse((await patMigrationItem.getValue()) ?? { notice: false, previousGist: null });
}

export async function migratePatConnection(): Promise<void> {
  const migrated = await patMigrationItem.getValue();
  if (!migrated) {
    const current = await storage.getItem<{ pat?: string; gistId?: string }>('sync:leetsrs:gistConnection');
    const pat = await storage.getItem('sync:leetsrs:githubPat');
    const gist = await storage.getItem<string>('sync:leetsrs:gistId');
    // Publish the retirement marker first; retries must never promote old credentials.
    await patMigrationItem.setValue({
      notice: !!(current?.pat || current?.gistId || pat || gist),
      previousGist: current?.gistId || gist || null,
    });
  }
  await storage.removeItems([...LEGACY_PAT_KEYS]);
}

export async function dismissMigrationNotice(): Promise<void> {
  const migration = await readPatMigration();
  await patMigrationItem.setValue({ ...migration, notice: false });
}

export async function previousGist(): Promise<string | null> {
  return (await readPatMigration()).previousGist;
}
