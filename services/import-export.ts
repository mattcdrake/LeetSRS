import { gistSyncConfigSchema } from '@/domain/gist-sync';
import type { ExportData, PreparedImportData } from '@/infrastructure/storage/backup';
import { parseBackup } from '@/infrastructure/storage/backup';
import { getAllCards, removeCards, saveCards } from '@/infrastructure/storage/cards';
import {
  readGistConnection,
  removeGistConnection,
  writeGistConnection,
} from '@/infrastructure/storage/gist-connection';
import { LATEST_SCHEMA_VERSION } from '@/infrastructure/storage/migrations/runner';
import { getStats, removeStats, saveStats } from '@/infrastructure/storage/stats';
import { readSyncMetadata, removeSyncMetadata, writeSyncMetadata } from '@/infrastructure/storage/sync-metadata';
import { exportSettings, resetSettings, updateSettings } from './settings';

export async function exportData(): Promise<string> {
  const [cards, stats, settings, connection, dataUpdatedAt] = await Promise.all([
    getAllCards(),
    getStats(),
    exportSettings(),
    readGistConnection(),
    readSyncMetadata('dataUpdatedAt'),
  ]);

  const exportData: ExportData = {
    schemaVersion: LATEST_SCHEMA_VERSION,
    exportDate: new Date().toISOString(),
    dataUpdatedAt: dataUpdatedAt ?? undefined,
    data: {
      cards: Object.fromEntries(cards.map((card) => [card.slug, card])),
      stats,
      settings,
      gistSync: {
        ...(connection.gistId != null && { gistId: connection.gistId }),
        enabled: connection.enabled,
      },
    },
  };

  return JSON.stringify(exportData, null, 2);
}

export async function applyImportData(preparedData: PreparedImportData): Promise<void> {
  // Prepare the complete replacement before reset; exports never contain the PAT.
  const { pat } = await readGistConnection();
  const connection = gistSyncConfigSchema.parse({ gistId: null, enabled: false, ...preparedData.gistSync, pat });
  await resetAllData();
  await writeGistConnection(connection);

  await saveCards(Object.values(preparedData.cards));
  await saveStats(preparedData.stats);
  await updateSettings(preparedData.settings);

  await writeSyncMetadata('dataUpdatedAt', preparedData.dataUpdatedAt);
}

export async function importData(jsonData: string): Promise<void> {
  const preparedData = parseBackup(jsonData);
  await applyImportData(preparedData);
}

export async function resetAllData(): Promise<void> {
  await removeCards();
  await removeStats();
  await resetSettings();
  await removeGistConnection();
  await removeSyncMetadata('lastSyncTime');
  await removeSyncMetadata('lastSyncDirection');
  await removeSyncMetadata('dataUpdatedAt');
}
