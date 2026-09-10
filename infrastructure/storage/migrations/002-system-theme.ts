import type { Migration } from './contract';
import { loadLegacyData } from './legacy-storage';
// Adding the system preference changed no stored values. Preserve all input, including malformed records.
export function migrate(data: unknown): unknown {
  return data;
}

export const systemThemeMigration: Migration = {
  description: 'Add system theme preference',
  load: loadLegacyData,
  migrate,
  save: async () => {},
};
