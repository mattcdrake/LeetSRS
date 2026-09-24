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

export const learningDocumentItem = storage.defineItem<unknown>('local:leetsrs:learningDocument');
export const popupDialogAcknowledgmentsItem = storage.defineItem<unknown>('local:leetsrs:popupDialogAcknowledgments');
export const gistConnectionItem = storage.defineItem<GistSyncConfig>('local:leetsrs:gistConnection');

let backgroundReadiness: Promise<void> | undefined;

// Background readers share startup's promise; other runtimes request it through RPC.
export function setBackgroundStorageReadiness(readiness: Promise<void>): void {
  backgroundReadiness = readiness;
}

function waitForStorageInitialization(): Promise<void> {
  return backgroundReadiness ?? background.waitForInitialization();
}

export async function readLearningDocument(): Promise<LearningDocument> {
  let document = await learningDocumentItem.getValue();
  const version = learningDocumentVersionSchema.safeParse(document);
  const needsInitialization =
    document == null || (version.success && version.data.schemaVersion < LEARNING_DOCUMENT_VERSION);

  if (needsInitialization) {
    await waitForStorageInitialization();
    document = await learningDocumentItem.getValue();
  }

  if (document == null) {
    throw new Error('Learning document is not initialized');
  }

  return learningDocumentSchema.parse(document);
}

export async function replaceLearningDocument(document: LearningDocument): Promise<LearningDocument> {
  const validated = learningDocumentSchema.parse(document);

  await learningDocumentItem.setValue(validated);
  return validated;
}

const popupDialogAcknowledgmentsSchema = z.record(z.string(), z.literal(true));
export type PopupDialogAcknowledgments = z.infer<typeof popupDialogAcknowledgmentsSchema>;

export async function readPopupDialogAcknowledgments(): Promise<PopupDialogAcknowledgments> {
  const stored = await popupDialogAcknowledgmentsItem.getValue();
  return popupDialogAcknowledgmentsSchema.parse(stored ?? {});
}

export function writePopupDialogAcknowledgments(acknowledgments: PopupDialogAcknowledgments): Promise<void> {
  return popupDialogAcknowledgmentsItem.setValue(popupDialogAcknowledgmentsSchema.parse(acknowledgments));
}

// Sync status is separate from the learning document and its edit timestamp.
export const lastSyncTimeItem = storage.defineItem<string>('local:leetsrs:lastSyncTime');

export function removeSyncStatus(): Promise<void> {
  // Clear the retired direction key during reset and sign-out.
  return storage.removeItems([lastSyncTimeItem, 'local:leetsrs:lastSyncDirection']);
}

export async function readGistConnection(): Promise<GistSyncConfig> {
  const connection = await gistConnectionItem.getValue();

  return gistSyncConfigSchema.parse(connection ?? { accountId: null, gistId: null, enabled: false });
}

export function writeGistConnection(config: GistSyncConfig): Promise<void> {
  return gistConnectionItem.setValue(gistSyncConfigSchema.parse(config));
}

export function removeGistConnection(): Promise<void> {
  // Retained legacy keys must also be cleared so reset reaches older browsers.
  return storage.removeItems([gistConnectionItem, ...LEGACY_PAT_KEYS]);
}
