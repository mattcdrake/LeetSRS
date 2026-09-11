import { z } from 'zod';
import { cardSchema } from '@/domain/cards';
import { gistSyncBackupSchema } from '@/domain/gist-sync';
import { noteSchema } from '@/domain/notes';
import { settingsUpdateSchema } from '@/domain/settings';
import { dailyStatsSchema } from '@/domain/statistics';
import { LATEST_SCHEMA_VERSION, migrateBackupData } from './migrations/runner';

// Preserve legacy timestamp formats accepted by Date.parse.
const timestampSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const envelopeSchema = z.object({
  schemaVersion: z.number().int().nonnegative().default(0),
  exportDate: timestampSchema,
  dataUpdatedAt: timestampSchema.optional(),
  // Keep the complete raw dataset intact for historical transformations.
  data: z.unknown().refine((value) => typeof value === 'object' && value !== null && !Array.isArray(value)),
});
const recordsSchema = z.object({
  cards: z.record(z.string(), cardSchema),
  stats: z.record(z.string(), dailyStatsSchema),
  notes: z.record(z.string(), noteSchema),
  settings: settingsUpdateSchema.prefault({}),
  gistSync: gistSyncBackupSchema.optional(),
});

export type ExportData = Omit<z.infer<typeof envelopeSchema>, 'data'> & {
  data: z.infer<typeof recordsSchema>;
};
export type PreparedBackup = ExportData['data'] & Pick<ExportData, 'dataUpdatedAt'>;

export function parseBackup(json: string): PreparedBackup {
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON format');
  }
  const envelope = envelopeSchema.parse(input);
  if (envelope.schemaVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(`Export is from a newer version (schema ${envelope.schemaVersion}). Please update the extension.`);
  }
  const records = recordsSchema.parse(migrateBackupData(envelope.data, envelope.schemaVersion));
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
  return { ...records, dataUpdatedAt: envelope.dataUpdatedAt };
}
