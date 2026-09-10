import type { StorageItemKey } from 'wxt/utils/storage';

// Cards may be absent in storage, and legacy records have not yet been validated.
export interface MigrationData {
  cards?: Record<string, unknown>;
}

export interface Migration {
  description: string;
  removeKeys?: readonly StorageItemKey[];
  migrate: (data: MigrationData) => MigrationData;
}
