import { z } from 'zod';
import type { Card } from './cards';
import { type Settings, validateSettings } from './settings';
import type { DailyStats } from './statistics';

const objectMapSchema = z.record(z.string(), z.unknown());
const structureSchema = z.looseObject({
  exportDate: z.unknown().refine(Boolean),
  data: objectMapSchema,
});
type BackupImportEnvelope = z.infer<typeof structureSchema>;
const schemaVersionSchema = z
  .number()
  .refine((value) => Number.isInteger(value) && value >= 0)
  .optional();
// Preserve legacy timestamp formats accepted by Date.parse.
const timestampSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const gistSyncSchema = z
  .looseObject({
    gistId: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .optional();

function parseImportField<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(message);
  return result.data;
}

export function validateImportStructure(data: unknown): asserts data is BackupImportEnvelope {
  parseImportField(structureSchema, data, 'Invalid export data structure');
}

function getImportedSettings(settings: unknown): Partial<Settings> {
  if (settings === undefined) return {};
  const values = parseImportField(objectMapSchema, settings, 'Invalid settings data');

  const resetEditorOnEveryProblem =
    values.resetEditorOnEveryProblem !== undefined ? values.resetEditorOnEveryProblem : values.autoClearLeetcode;
  const { animationsEnabled: _animationsEnabled, autoClearLeetcode: _autoClearLeetcode, ...currentSettings } = values;
  const importedSettings = {
    ...currentSettings,
    ...(resetEditorOnEveryProblem !== undefined && { resetEditorOnEveryProblem }),
  };
  // Validate known settings while retaining unrelated fields for compatibility.
  validateSettings(importedSettings as Partial<Settings>);
  return importedSettings as Partial<Settings>;
}

export function normalizeImportData(data: BackupImportEnvelope, currentSchema: number) {
  const importedSchema = parseImportField(schemaVersionSchema, data.schemaVersion, 'Invalid schema version') ?? 0;
  if (importedSchema > currentSchema) {
    throw new Error(`Export is from a newer version (schema ${importedSchema}). Please update the extension.`);
  }
  parseImportField(timestampSchema, data.exportDate, 'Invalid export timestamp');
  const dataUpdatedAt = parseImportField(timestampSchema.optional(), data.dataUpdatedAt, 'Invalid update timestamp');

  return {
    schemaVersion: importedSchema,
    cards: parseImportField(objectMapSchema, data.data.cards, 'Invalid cards data'),
    stats: parseImportField(objectMapSchema, data.data.stats, 'Invalid stats data'),
    notes: parseImportField(objectMapSchema, data.data.notes, 'Invalid notes data'),
    settings: getImportedSettings(data.data.settings),
    gistSync: parseImportField(gistSyncSchema, data.data.gistSync, 'Invalid Gist sync configuration'),
    dataUpdatedAt,
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
