import type { Migration } from './contract';
import { loadLegacyData } from './legacy-storage';

// Adding the system preference changed no stored values. Preserve all input, including malformed records.
function migrate<Dataset>(data: Dataset): Dataset {
  return data;
}

export const systemThemeMigration = {
  description: 'Add system theme preference',
  load: loadLegacyData,
  migrate,
  save: async () => {},
} satisfies Migration;
