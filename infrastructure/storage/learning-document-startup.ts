import { z } from 'zod';
import { storage } from '#imports';
import { gistSyncConfigSchema } from '@/domain/gist-sync';
import { LEARNING_DOCUMENT_VERSION } from '@/domain/learning-document';
import { writeGistConnection } from './gist-connection';
import { convertLearningDocument, replaceLearningDocument } from './learning-document';
import { STORAGE_KEYS } from './storage-keys';

const legacySettingNames = [
  'maxNewCardsPerDay',
  'theme',
  'resetEditorOnEveryProblem',
  'resetEditorOnDueReview',
  'badgeEnabled',
  'language',
  'dayStartHour',
  'autoClearLeetcode',
] as const;

function gatherLegacyDocument(local: Record<string, unknown>, sync: Record<string, unknown>) {
  const version = Object.hasOwn(local, 'leetsrs:schemaVersion') ? local['leetsrs:schemaVersion'] : 0;
  const schemaVersion = z.int().min(0).max(5).parse(version);
  const data: Record<string, unknown> = { schemaVersion };

  for (const name of ['cards', 'stats', 'dataUpdatedAt']) {
    if (Object.hasOwn(local, `leetsrs:${name}`)) {
      data[name] = local[`leetsrs:${name}`];
    }
  }

  data.settings = Object.fromEntries(
    legacySettingNames
      .filter((name) => Object.hasOwn(sync, `leetsrs:${name}`))
      .map((name) => [name, sync[`leetsrs:${name}`]])
  );

  if (schemaVersion < 4) {
    data.notes = Object.fromEntries(
      Object.entries(local)
        .filter(([key]) => key.startsWith('leetsrs:notes:'))
        .map(([key, value]) => [key.slice('leetsrs:notes:'.length), value])
    );
  }

  return convertLearningDocument(data);
}

async function promoteLegacyConnection(sync: Record<string, unknown>): Promise<void> {
  if (Object.hasOwn(sync, 'leetsrs:gistConnection')) {
    gistSyncConfigSchema.parse(sync['leetsrs:gistConnection']);
    return;
  }

  const connection = gistSyncConfigSchema.parse({
    pat: z.string().default('').parse(sync['leetsrs:githubPat']),
    gistId: z.string().nullable().default(null).parse(sync['leetsrs:gistId']),
    enabled: z.boolean().default(false).parse(sync['leetsrs:gistSyncEnabled']),
  });

  await writeGistConnection(connection);
}

// Prepared for background startup activation in #378.
export async function initializeLearningDocument(): Promise<void> {
  const saved = await storage.getItem<unknown>(STORAGE_KEYS.learningDocument);

  if (saved != null) {
    // Stored documents must declare their version; only scattered installs may be unversioned.
    const { schemaVersion } = z.object({ schemaVersion: z.int().nonnegative() }).parse(saved);
    const document = convertLearningDocument(saved);

    if (schemaVersion !== LEARNING_DOCUMENT_VERSION) {
      await replaceLearningDocument(document);
    }

    return;
  }

  const [local, sync] = await Promise.all([storage.snapshot('local'), storage.snapshot('sync')]);
  const document = gatherLegacyDocument(local, sync);

  await promoteLegacyConnection(sync);
  await replaceLearningDocument(document);

  try {
    await storage.removeItems([
      STORAGE_KEYS.cards,
      STORAGE_KEYS.stats,
      STORAGE_KEYS.dataUpdatedAt,
      STORAGE_KEYS.schemaVersion,
      ...Object.keys(local)
        .filter((key) => key.startsWith('leetsrs:notes:'))
        .map((key): `local:${string}` => `local:${key}`),
      ...legacySettingNames.map((name): `sync:${string}` => `sync:leetsrs:${name}`),
    ]);
  } catch (error) {
    // Publication succeeded. Retained legacy values must never become authoritative again.
    console.warn('Failed to clean up legacy learning data:', error);
  }
}
