import { z } from 'zod';
import { cardSchema } from '@/domain/cards';
import { gistSyncBackupSchema } from '@/domain/gist-sync';
import { noteSchema } from '@/domain/notes';
import { settingsUpdateSchema } from '@/domain/settings';
import { dailyStatsSchema } from '@/domain/statistics';
import { LATEST_SCHEMA_VERSION, migrateBackupData } from './migrations/runner';

const schemaVersionSchema = z.number().int().nonnegative();
const timestampSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const backupMetadataSchema = z.object({
  schemaVersion: schemaVersionSchema,
  exportDate: timestampSchema,
  dataUpdatedAt: timestampSchema.optional(),
});
const backupEnvelopeSchema = backupMetadataSchema.extend({
  schemaVersion: schemaVersionSchema.default(0),
  // Validate the declared contract before migrations or field stripping.
  data: z.unknown(),
});

export const exportDataSchema = backupMetadataSchema.extend({
  data: z.object({
    cards: z.record(z.string(), cardSchema),
    stats: z.record(z.string(), dailyStatsSchema),
    notes: z.record(z.string(), noteSchema),
    settings: settingsUpdateSchema.default({}),
    gistSync: gistSyncBackupSchema.optional(),
  }),
});
export type ExportData = z.infer<typeof exportDataSchema>;

export type PreparedImportData = ExportData['data'] & {
  dataUpdatedAt: NonNullable<ExportData['dataUpdatedAt']>;
};

export function parseBackup(json: string): PreparedImportData {
  let decoded: unknown;
  try {
    decoded = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }

  const { schemaVersion, exportDate, dataUpdatedAt, data } = backupEnvelopeSchema.parse(decoded);
  if (schemaVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(`Export is from a newer version (schema ${schemaVersion}). Please update the extension.`);
  }
  const migrated = migrateBackupData(data, schemaVersion);
  const records = exportDataSchema.shape.data.parse(migrated);
  validateRelationships(records);
  return { ...records, dataUpdatedAt: dataUpdatedAt ?? exportDate };
}

function validateRelationships(records: ExportData['data']): void {
  const cardIds = new Set<string>();
  for (const [slug, card] of Object.entries(records.cards)) {
    if (card.slug !== slug) throw new Error(`Card slug does not match key: ${slug}`);
    if (cardIds.has(card.id)) throw new Error(`Duplicate card ID: ${card.id}`);
    cardIds.add(card.id);
  }
  for (const [date, stats] of Object.entries(records.stats)) {
    if (stats.date !== date) throw new Error(`Stats date does not match key: ${date}`);
  }
  for (const id of Object.keys(records.notes)) {
    if (!cardIds.has(id)) throw new Error(`Note has no owning card: ${id}`);
  }
}
