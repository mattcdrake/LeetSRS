import { z } from 'zod';
import { storage } from '#imports';
import type { Migration } from './contract';
import { loadLegacyData } from './legacy-storage';

const datasetSchema = z.looseObject({ settings: z.record(z.string(), z.unknown()).optional() });

type InputDataset = z.infer<typeof datasetSchema>;
type OutputDataset = InputDataset & {
  settings?: Record<string, unknown> & { dayStartHour?: never };
};

function validateDataset(data: unknown): asserts data is InputDataset {
  // Use validation without the parsed copy so historical JSON keys remain intact.
  datasetSchema.parse(data);
}

function validateOutput(data: unknown): asserts data is OutputDataset {
  validateDataset(data);
  if (data.settings && Object.hasOwn(data.settings, 'dayStartHour')) {
    throw new Error('Migrated settings must not contain dayStartHour');
  }
}

function migrate(data: unknown): OutputDataset {
  validateDataset(data);
  let output = data;
  if (data.settings) {
    // Discard only the retired setting, regardless of its value. Preserve other historical fields.
    const { dayStartHour: _removed, ...settings } = data.settings;
    output = { ...data, settings };
  }
  validateOutput(output);
  return output;
}

export const removeDayStartMigration = {
  description: 'Remove configurable day start',
  load: loadLegacyData,
  migrate,
  save: async () => {},
  cleanup: () => storage.removeItems(['sync:leetsrs:dayStartHour']),
} satisfies Migration;
