import { z } from 'zod';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument, learningDocumentSchema } from '@/domain/learning-document';
import * as addCardDomain from './document-conversions/001-add-card-domain';
import * as addSystemTheme from './document-conversions/002-add-system-theme';
import * as removeDayStart from './document-conversions/003-remove-day-start';
import * as embedNotes from './document-conversions/004-embed-notes';
import * as combineGistConnection from './document-conversions/005-combine-gist-connection';
import * as learningDocument from './document-conversions/006-learning-document';
import { legacyBackupSchema } from './document-conversions/backup-envelope';

const conversions = [
  addCardDomain,
  addSystemTheme,
  removeDayStart,
  embedNotes,
  combineGistConnection,
  learningDocument,
] as const;
const LAST_LEGACY_DATASET_VERSION = 5;

const versionedInputSchema = z.looseObject({ schemaVersion: z.int().nonnegative().default(0) });

// Accepts an in-memory legacy installation or an already-versioned document.
// Runtime activation and gathering legacy storage are prepared separately.
export function convertLearningDocument(input: unknown): LearningDocument {
  const { schemaVersion, ...data } = versionedInputSchema.parse(input);
  if (schemaVersion > LEARNING_DOCUMENT_VERSION) throw new Error(`Unsupported schema version: ${schemaVersion}`);
  // Versions 0–5 stored the version separately; v6 introduced the document envelope.
  let converted: unknown = schemaVersion <= LAST_LEGACY_DATASET_VERSION ? data : input;
  if (schemaVersion > 0) conversions[schemaVersion - 1].outputSchema.parse(converted);
  for (const conversion of conversions.slice(schemaVersion)) converted = conversion.convert(converted);
  return learningDocumentSchema.parse(converted);
}

export function parseLearningDocumentBackup(json: string): LearningDocument {
  let decoded: unknown;
  try {
    decoded = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }
  const { schemaVersion } = versionedInputSchema.parse(decoded);
  if (schemaVersion > LAST_LEGACY_DATASET_VERSION) return convertLearningDocument(decoded);
  const { data, dataUpdatedAt, exportDate } = legacyBackupSchema.parse(decoded);
  return convertLearningDocument({ ...data, schemaVersion, dataUpdatedAt: dataUpdatedAt ?? exportDate });
}
