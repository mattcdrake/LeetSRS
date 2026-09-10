import type { Migration } from './types';

export const addSystemThemeMigration: Migration = {
  description: 'Add system theme preference',
  migrate: (data) => data,
};
