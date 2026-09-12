import { z } from 'zod';
import { LEARNING_DOCUMENT_VERSION, type LearningDocument, learningDocumentSchema } from '@/domain/learning-document';
import * as addCardDomain from './document-conversions/001-add-card-domain';
import * as addSystemTheme from './document-conversions/002-add-system-theme';
import * as removeDayStart from './document-conversions/003-remove-day-start';
import * as embedNotes from './document-conversions/004-embed-notes';
import * as combineGistConnection from './document-conversions/005-combine-gist-connection';
import { historicalRecordsSchema, legacyBackupSchema } from './document-conversions/historical-records';

const historicalConversions = [
  addCardDomain,
  addSystemTheme,
  removeDayStart,
  embedNotes,
  combineGistConnection,
] as const;

const versionedInputSchema = z.looseObject({ schemaVersion: z.int().nonnegative().default(0) });

// Accepts an in-memory legacy installation or an already-versioned document.
// Runtime activation and gathering legacy storage are prepared separately.
export function convertLearningDocument(input: unknown): LearningDocument {
  const { schemaVersion, ...data } = versionedInputSchema.parse(input);
  if (schemaVersion > LEARNING_DOCUMENT_VERSION) throw new Error(`Unsupported schema version: ${schemaVersion}`);
  if (schemaVersion === LEARNING_DOCUMENT_VERSION) return learningDocumentSchema.parse(input);
  if (schemaVersion > 0) historicalConversions[schemaVersion - 1].validateOutput(data);
  let converted: unknown = data;
  for (const conversion of historicalConversions.slice(schemaVersion)) converted = conversion.convert(converted);
  const records = historicalRecordsSchema.parse(converted);
  return learningDocumentSchema.parse({ ...records, schemaVersion: LEARNING_DOCUMENT_VERSION });
}

export function parseLearningDocumentBackup(json: string): LearningDocument {
  let decoded: unknown;
  try {
    decoded = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }
  const { schemaVersion } = versionedInputSchema.parse(decoded);
  if (schemaVersion >= LEARNING_DOCUMENT_VERSION) return convertLearningDocument(decoded);
  const { data, dataUpdatedAt, exportDate } = legacyBackupSchema.parse(decoded);
  return convertLearningDocument({ ...data, schemaVersion, dataUpdatedAt: dataUpdatedAt ?? exportDate });
}
