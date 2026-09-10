import { z } from 'zod';
import { storage } from '#imports';
import type { Migration } from './contract';
import { loadLegacyData } from './legacy-storage';

const datasetSchema = z.looseObject({ settings: z.record(z.string(), z.unknown()).optional() });

export function migrate(data: unknown): unknown {
  const dataset = datasetSchema.parse(data);
  if (!dataset.settings) return dataset;
  // Discard only the retired setting, regardless of its value. Preserve other historical fields.
  const { dayStartHour: _removed, ...settings } = dataset.settings;
  return { ...dataset, settings };
}

export const removeDayStartMigration: Migration = {
  description: 'Remove configurable day start',
  load: loadLegacyData,
  migrate,
  save: async () => {},
  cleanup: () => storage.removeItems(['sync:leetsrs:dayStartHour']),
};
