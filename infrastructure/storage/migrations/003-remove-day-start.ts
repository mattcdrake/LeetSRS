import { z } from 'zod';
import { storage } from '#imports';
import type { Migration } from './contract';
import { loadLegacyData } from './legacy-storage';

const datasetSchema = z.looseObject({ settings: z.record(z.string(), z.unknown()).optional() });

export function migrate(data: unknown): unknown {
  validateDataset(data);
  if (!data.settings) return data;
  // Discard only the retired setting, regardless of its value. Preserve other historical fields.
  const { dayStartHour: _removed, ...settings } = data.settings;
  return { ...data, settings };
}

function validateDataset(data: unknown): asserts data is z.infer<typeof datasetSchema> {
  // Use validation without the parsed copy so historical JSON keys remain intact.
  datasetSchema.parse(data);
}

export const removeDayStartMigration: Migration = {
  description: 'Remove configurable day start',
  load: loadLegacyData,
  migrate,
  save: async () => {},
  cleanup: () => storage.removeItems(['sync:leetsrs:dayStartHour']),
};
