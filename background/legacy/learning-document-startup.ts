import { z } from 'zod';
import { storage } from '#imports';
import { convertLearningDocument } from '@/background/legacy/learning-document-conversions';
import { LEARNING_DOCUMENT_VERSION, learningDocumentVersionSchema } from '@/shared/models';
import { learningDocumentItem, replaceLearningDocument } from '@/shared/storage';

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

export async function initializeLearningDocument(): Promise<void> {
  const saved = await learningDocumentItem.getValue();

  if (saved != null) {
    // Stored documents must declare their version; only scattered installs may be unversioned.
    const { schemaVersion } = learningDocumentVersionSchema.parse(saved);
    const document = convertLearningDocument(saved);

    if (schemaVersion !== LEARNING_DOCUMENT_VERSION) {
      await replaceLearningDocument(document);
    }

    return;
  }

  const [local, sync] = await Promise.all([storage.snapshot('local'), storage.snapshot('sync')]);
  const document = gatherLegacyDocument(local, sync);

  await replaceLearningDocument(document);

  try {
    await removeLegacyLearningData();
  } catch (error) {
    // Publication succeeded. Retained legacy values must never become authoritative again.
    console.warn('Failed to clean up legacy learning data:', error);
  }
}

export async function removeLegacyLearningData(): Promise<void> {
  const local = await storage.snapshot('local');
  await storage.removeItems([
    'local:leetsrs:cards',
    'local:leetsrs:stats',
    'local:leetsrs:dataUpdatedAt',
    'local:leetsrs:schemaVersion',
    ...Object.keys(local)
      .filter((key) => key.startsWith('leetsrs:notes:'))
      .map((key): `local:${string}` => `local:${key}`),
    ...legacySettingNames.map((name): `sync:${string}` => `sync:leetsrs:${name}`),
  ]);
}
