import { normalizeImportData, validateImportRelationships, validateImportStructure } from '@/domain/backup-import';
import type { ExportData, PreparedImportData } from '@/infrastructure/storage/backup';
import { validateBackupRecords } from '@/infrastructure/storage/backup';
import { getAllCards, removeCards, saveCards } from '@/infrastructure/storage/cards';
import {
  CURRENT_SCHEMA_VERSION,
  getCurrentSchemaVersion,
  migrateBackupData,
} from '@/infrastructure/storage/migrations';
import { getStats, removeStats, saveStats } from '@/infrastructure/storage/stats';
import { readSyncMetadata, removeSyncMetadata, writeSyncMetadata } from '@/infrastructure/storage/sync-metadata';
import { getGitHubPat, removeGitHubPat, setGitHubPat } from './github-auth';
import { exportSettings, resetSettings, updateSettings } from './settings';

export async function exportData(): Promise<string> {
  const [cards, stats, settings, gistId, gistSyncEnabled, dataUpdatedAt] = await Promise.all([
    getAllCards(),
    getStats(),
    exportSettings(),
    readSyncMetadata('gistId'),
    readSyncMetadata('gistSyncEnabled'),
    readSyncMetadata('dataUpdatedAt'),
  ]);

  const exportData: ExportData = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportDate: new Date().toISOString(),
    dataUpdatedAt: dataUpdatedAt ?? undefined,
    data: {
      cards: Object.fromEntries(cards.map((card) => [card.slug, card])),
      stats,
      settings,
      gistSync: {
        ...(gistId != null && { gistId }),
        ...(gistSyncEnabled != null && { enabled: gistSyncEnabled }),
      },
    },
  };

  return JSON.stringify(exportData, null, 2);
}

export async function prepareImportData(jsonData: string): Promise<PreparedImportData> {
  let data: unknown;
  try {
    data = JSON.parse(jsonData);
  } catch {
    throw new Error('Invalid JSON format');
  }

  validateImportStructure(data);
  const currentSchema = await getCurrentSchemaVersion();
  const { schemaVersion, ...normalizedData } = normalizeImportData(data, currentSchema);
  const migrated = migrateBackupData({ cards: normalizedData.cards, notes: normalizedData.notes }, schemaVersion);
  const validRecords = validateBackupRecords({
    cards: migrated.cards,
    stats: normalizedData.stats,
  });
  validateImportRelationships(validRecords);

  return {
    ...validRecords,
    settings: normalizedData.settings,
    gistSync: normalizedData.gistSync,
    dataUpdatedAt: normalizedData.dataUpdatedAt ?? new Date().toISOString(),
  };
}

export async function applyImportData(preparedData: PreparedImportData): Promise<void> {
  // Preserve PAT before reset (it's not in export for security)
  const existingPat = await getGitHubPat();
  await resetAllData();

  if (existingPat) {
    await setGitHubPat(existingPat);
  }

  await saveCards(Object.values(preparedData.cards));
  await saveStats(preparedData.stats);
  await updateSettings(preparedData.settings);

  if (preparedData.gistSync) {
    if (preparedData.gistSync.gistId != null) {
      await writeSyncMetadata('gistId', preparedData.gistSync.gistId);
    }
    if (preparedData.gistSync.enabled != null) {
      await writeSyncMetadata('gistSyncEnabled', preparedData.gistSync.enabled);
    }
  }

  await writeSyncMetadata('dataUpdatedAt', preparedData.dataUpdatedAt);
}

export async function importData(jsonData: string): Promise<void> {
  const preparedData = await prepareImportData(jsonData);
  await applyImportData(preparedData);
}

export async function resetAllData(): Promise<void> {
  await removeCards();
  await removeStats();
  await resetSettings();
  await removeGitHubPat();
  await removeSyncMetadata('gistId');
  await removeSyncMetadata('gistSyncEnabled');
  await removeSyncMetadata('lastSyncTime');
  await removeSyncMetadata('lastSyncDirection');
  await removeSyncMetadata('dataUpdatedAt');
}
