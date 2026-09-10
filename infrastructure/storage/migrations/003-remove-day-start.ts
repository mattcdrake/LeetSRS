import type { Migration } from './types';

export const removeDayStartMigration: Migration = {
  description: 'Remove configurable day start',
  migrate: (data) => data,
  removeKeys: ['sync:leetsrs:dayStartHour'],
};
