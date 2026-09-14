import { z } from 'zod';
import { storage } from '#imports';
import { sendMessage } from '@/shared/messages';
import {
  type GistSyncConfig,
  gistSyncConfigSchema,
  LEARNING_DOCUMENT_VERSION,
  type LearningDocument,
  learningDocumentSchema,
  learningDocumentVersionSchema,
} from '@/shared/models';

let backgroundReadiness: Promise<void> | undefined;

// Background readers share startup's promise; other runtimes request it through RPC.
export function setBackgroundStorageReadiness(readiness: Promise<void>): void {
  backgroundReadiness = readiness;
}

function waitForStorageInitialization(): Promise<void> {
  return backgroundReadiness ?? sendMessage('waitForInitialization');
}

export async function readLearningDocument(): Promise<LearningDocument> {
  let document = await storage.getItem<unknown>(STORAGE_KEYS.learningDocument);
  const version = learningDocumentVersionSchema.safeParse(document);
  const needsInitialization =
    document == null || (version.success && version.data.schemaVersion < LEARNING_DOCUMENT_VERSION);

  if (needsInitialization) {
    await waitForStorageInitialization();
    document = await storage.getItem<unknown>(STORAGE_KEYS.learningDocument);
  }

  if (document == null) {
    throw new Error('Learning document is not initialized');
  }

  return learningDocumentSchema.parse(document);
}

export async function replaceLearningDocument(document: LearningDocument): Promise<LearningDocument> {
  const validated = learningDocumentSchema.parse(document);

  await storage.setItem(STORAGE_KEYS.learningDocument, validated);
  return validated;
}

export const STORAGE_KEYS = {
  learningDocument: 'local:leetsrs:learningDocument',
  // GitHub Gist Sync
  gistConnection: 'sync:leetsrs:gistConnection',
  lastSyncTime: 'local:leetsrs:lastSyncTime',
  lastSyncDirection: 'local:leetsrs:lastSyncDirection',
} as const;

// Sync status is separate from the learning document and its edit timestamp.
const syncMetadataSchema = z.object({
  lastSyncTime: z.string(),
  lastSyncDirection: z.enum(['push', 'pull']),
});

const syncStatusUpdateSchema = syncMetadataSchema.partial({ lastSyncDirection: true });
const storedSyncStatusSchema = z.object({
  lastSyncTime: syncMetadataSchema.shape.lastSyncTime.nullable(),
  lastSyncDirection: syncMetadataSchema.shape.lastSyncDirection.nullable(),
});

export async function readSyncStatus(): Promise<z.infer<typeof storedSyncStatusSchema>> {
  const [{ value: lastSyncTime = null }, { value: lastSyncDirection = null }] = await storage.getItems([
    STORAGE_KEYS.lastSyncTime,
    STORAGE_KEYS.lastSyncDirection,
  ]);

  return storedSyncStatusSchema.parse({ lastSyncTime, lastSyncDirection });
}

export async function writeSyncStatus(status: z.infer<typeof syncStatusUpdateSchema>): Promise<void> {
  const prepared = syncStatusUpdateSchema.parse(status);
  const items: { key: typeof STORAGE_KEYS.lastSyncTime | typeof STORAGE_KEYS.lastSyncDirection; value: string }[] = [
    { key: STORAGE_KEYS.lastSyncTime, value: prepared.lastSyncTime },
  ];
  if (prepared.lastSyncDirection !== undefined) {
    items.push({ key: STORAGE_KEYS.lastSyncDirection, value: prepared.lastSyncDirection });
  }

  await storage.setItems(items);
}

export function removeSyncStatus(): Promise<void> {
  return storage.removeItems([STORAGE_KEYS.lastSyncTime, STORAGE_KEYS.lastSyncDirection]);
}

export async function readGistConnection(): Promise<GistSyncConfig> {
  let connection = await storage.getItem<unknown>(STORAGE_KEYS.gistConnection);
  if (connection == null) {
    await waitForStorageInitialization();
    connection = await storage.getItem<unknown>(STORAGE_KEYS.gistConnection);
  }

  return gistSyncConfigSchema.parse(connection ?? { pat: '', gistId: null, enabled: false });
}

export function writeGistConnection(config: GistSyncConfig): Promise<void> {
  return storage.setItem(STORAGE_KEYS.gistConnection, gistSyncConfigSchema.parse(config));
}

export function removeGistConnection(): Promise<void> {
  // Retained legacy keys must also be cleared so reset reaches older browsers.
  return storage.removeItems([
    STORAGE_KEYS.gistConnection,
    'sync:leetsrs:githubPat',
    'sync:leetsrs:gistId',
    'sync:leetsrs:gistSyncEnabled',
  ]);
}
