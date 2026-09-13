import {
  LEARNING_DOCUMENT_VERSION,
  type LearningDocument,
  learningDocumentSchema,
  learningDocumentVersionSchema,
} from '@/domain/learning-document';
import * as addCardDomain from './document-conversions/001-add-card-domain';
import * as addSystemTheme from './document-conversions/002-add-system-theme';
import * as removeDayStart from './document-conversions/003-remove-day-start';
import * as embedNotes from './document-conversions/004-embed-notes';
import * as combineGistConnection from './document-conversions/005-combine-gist-connection';
import * as learningDocument from './document-conversions/006-learning-document';
import { legacyBackupSchema } from './document-conversions/legacy-backup-envelope';

const conversions = [
  addCardDomain,
  addSystemTheme,
  removeDayStart,
  embedNotes,
  combineGistConnection,
  learningDocument,
] as const;

const LAST_LEGACY_DATASET_VERSION = 5;

const versionedInputSchema = learningDocumentVersionSchema.loose().extend({
  schemaVersion: learningDocumentVersionSchema.shape.schemaVersion.default(0),
});

// Accepts an in-memory legacy installation or an already-versioned document.
export function convertLearningDocument(input: unknown): LearningDocument {
  const { schemaVersion, ...data } = versionedInputSchema.parse(input);

  if (schemaVersion > LEARNING_DOCUMENT_VERSION) {
    throw new Error(`Unsupported schema version: ${schemaVersion}`);
  }

  // Versions 0–5 stored the version separately; v6 introduced the document envelope.
  let convertedData: unknown = data;

  if (schemaVersion > LAST_LEGACY_DATASET_VERSION) {
    convertedData = input;
  }

  if (schemaVersion > 0) {
    const declaredSchema = conversions[schemaVersion - 1].outputSchema;
    declaredSchema.parse(convertedData);
  }

  const remainingConversions = conversions.slice(schemaVersion);

  for (const conversion of remainingConversions) {
    convertedData = conversion.convert(convertedData);
  }

  return learningDocumentSchema.parse(convertedData);
}

export function parseLearningDocumentBackup(json: string): LearningDocument {
  let decodedBackup: unknown;

  try {
    decodedBackup = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }

  const { schemaVersion } = versionedInputSchema.parse(decodedBackup);

  if (schemaVersion > LAST_LEGACY_DATASET_VERSION) {
    return convertLearningDocument(decodedBackup);
  }

  const { data, dataUpdatedAt, exportDate } = legacyBackupSchema.parse(decodedBackup);

  return convertLearningDocument({
    ...data,
    schemaVersion,
    dataUpdatedAt: dataUpdatedAt ?? exportDate,
  });
}
