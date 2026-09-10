import { z } from 'zod';
import type { Card } from './cards';
import { gistSyncBackupSchema } from './gist-sync';
import { SETTING_KEYS, type Settings, settingsUpdateSchema } from './settings';
import type { DailyStats } from './statistics';

const objectMapSchema = z.record(z.string(), z.unknown());
const structureSchema = z.object({
  schemaVersion: z.unknown().optional(),
  exportDate: z.unknown().refine(Boolean),
  dataUpdatedAt: z.unknown().optional(),
  data: z.unknown().refine((value) => value !== undefined, 'Missing backup data'),
});

const schemaVersionSchema = z.number().refine((value) => Number.isInteger(value) && value >= 0);
// Preserve legacy timestamp formats accepted by Date.parse.
const timestampSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));

export const backupMetadataSchema = z.object({
  schemaVersion: schemaVersionSchema,
  exportDate: timestampSchema,
  dataUpdatedAt: timestampSchema.optional(),
});

function getImportedSettings(settings: unknown): Partial<Settings> {
  if (settings === undefined) return {};
  const values = objectMapSchema.parse(settings);

  const resetEditorOnEveryProblem =
    values.resetEditorOnEveryProblem !== undefined ? values.resetEditorOnEveryProblem : values.autoClearLeetcode;
  const importedSettings = Object.fromEntries(
    SETTING_KEYS.filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]])
  );
  if (resetEditorOnEveryProblem !== undefined) {
    importedSettings.resetEditorOnEveryProblem = resetEditorOnEveryProblem;
  }
  return settingsUpdateSchema.parse(importedSettings);
}

export function normalizeImportData(data: unknown, currentSchema: number) {
  const envelope = parseImportEnvelope(data, currentSchema);
  const dataset = objectMapSchema.parse(envelope.data);

  return {
    schemaVersion: envelope.schemaVersion,
    cards: objectMapSchema.parse(dataset.cards),
    stats: objectMapSchema.parse(dataset.stats),
    notes: objectMapSchema.parse(dataset.notes),
    settings: getImportedSettings(dataset.settings),
    gistSync: gistSyncBackupSchema.optional().parse(dataset.gistSync),
    dataUpdatedAt: envelope.dataUpdatedAt,
  };
}

export function parseImportEnvelope(input: unknown, currentSchema: number) {
  const data = structureSchema.parse(input);
  const importedSchema = schemaVersionSchema.optional().parse(data.schemaVersion) ?? 0;
  if (importedSchema > currentSchema) {
    throw new Error(`Export is from a newer version (schema ${importedSchema}). Please update the extension.`);
  }
  timestampSchema.parse(data.exportDate);
  const dataUpdatedAt = timestampSchema.optional().parse(data.dataUpdatedAt);

  return {
    schemaVersion: importedSchema,
    exportDate: data.exportDate,
    dataUpdatedAt,
    data: data.data,
  };
}

export function validateImportRelationships(records: {
  cards: Record<string, Pick<Card, 'id' | 'slug'>>;
  stats: Record<string, Pick<DailyStats, 'date'>>;
  notes: Record<string, unknown>;
}): void {
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
