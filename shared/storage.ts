import { z } from 'zod';
import { storage } from '#imports';
import { background } from '@/shared/background-service';
import { LEGACY_PAT_KEYS } from '@/shared/legacy/github-pat';
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
  return backgroundReadiness ?? background.waitForInitialization();
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
  popupDialogAcknowledgments: 'local:leetsrs:popupDialogAcknowledgments',
  // GitHub Gist Sync
  gistConnection: 'local:leetsrs:gistConnection',
  lastSyncTime: 'local:leetsrs:lastSyncTime',
} as const;

const popupDialogAcknowledgmentsSchema = z.record(z.string(), z.literal(true));
export type PopupDialogAcknowledgments = z.infer<typeof popupDialogAcknowledgmentsSchema>;

export async function readPopupDialogAcknowledgments(): Promise<PopupDialogAcknowledgments> {
  const stored = await storage.getItem<unknown>(STORAGE_KEYS.popupDialogAcknowledgments);
  return popupDialogAcknowledgmentsSchema.parse(stored ?? {});
}

export function writePopupDialogAcknowledgments(acknowledgments: PopupDialogAcknowledgments): Promise<void> {
  return storage.setItem(
    STORAGE_KEYS.popupDialogAcknowledgments,
    popupDialogAcknowledgmentsSchema.parse(acknowledgments)
  );
}

// Sync status is separate from the learning document and its edit timestamp.
const syncStatusUpdateSchema = z.object({
  lastSyncTime: z.string(),
});
const storedSyncStatusSchema = z.object({
  lastSyncTime: syncStatusUpdateSchema.shape.lastSyncTime.nullable(),
});

export async function readSyncStatus(): Promise<z.infer<typeof storedSyncStatusSchema>> {
  const lastSyncTime = await storage.getItem(STORAGE_KEYS.lastSyncTime);
  return storedSyncStatusSchema.parse({ lastSyncTime });
}

export async function writeSyncStatus(status: z.infer<typeof syncStatusUpdateSchema>): Promise<void> {
  const prepared = syncStatusUpdateSchema.parse(status);
  await storage.setItem(STORAGE_KEYS.lastSyncTime, prepared.lastSyncTime);
}

export function removeSyncStatus(): Promise<void> {
  // Clear the retired direction key during reset and sign-out.
  return storage.removeItems([STORAGE_KEYS.lastSyncTime, 'local:leetsrs:lastSyncDirection']);
}

export async function readGistConnection(): Promise<GistSyncConfig> {
  const connection = await storage.getItem<unknown>(STORAGE_KEYS.gistConnection);

  return gistSyncConfigSchema.parse(connection ?? { accountId: null, gistId: null, enabled: false });
}

export function writeGistConnection(config: GistSyncConfig): Promise<void> {
  return storage.setItem(STORAGE_KEYS.gistConnection, gistSyncConfigSchema.parse(config));
}

export function removeGistConnection(): Promise<void> {
  // Retained legacy keys must also be cleared so reset reaches older browsers.
  return storage.removeItems([STORAGE_KEYS.gistConnection, ...LEGACY_PAT_KEYS]);
}
