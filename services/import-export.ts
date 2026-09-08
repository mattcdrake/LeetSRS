import { normalizeImportData, validateImportStructure } from '@/domain/backup-import';
import {
  type ExportData,
  encodeExportData,
  type PreparedImportData,
  parseImportData,
} from '@/infrastructure/storage/backup/codec';
import {
  readSnapshotCards,
  readSnapshotNotes,
  removeSnapshotCards,
  removeSnapshotNotes,
  writeSnapshotCards,
  writeSnapshotNotes,
} from '@/infrastructure/storage/backup/snapshot';
import { getCurrentSchemaVersion } from '@/infrastructure/storage/migrations';
import { getStats, removeStats, saveStats } from '@/infrastructure/storage/stats';
import { readSyncMetadata, removeSyncMetadata, writeSyncMetadata } from '@/infrastructure/storage/sync-metadata';
import { exportSettings, resetSettings, updateSettings } from './settings';

export async function exportData(): Promise<string> {
  const cardsPromise = readSnapshotCards().then((cards) => cards ?? {});
  const [cards, stats, notes, settings, gistId, gistSyncEnabled, dataUpdatedAt, schemaVersion] = await Promise.all([
    cardsPromise,
    getStats(),
    cardsPromise.then((cards) => readSnapshotNotes(cards)),
    exportSettings(),
    readSyncMetadata('gistId'),
    readSyncMetadata('gistSyncEnabled'),
    readSyncMetadata('dataUpdatedAt'),
    getCurrentSchemaVersion(),
  ]);

  const exportData: ExportData = {
    schemaVersion,
    exportDate: new Date().toISOString(),
    dataUpdatedAt: dataUpdatedAt ?? undefined,
    data: {
      cards,
      stats,
      notes,
      settings,
      gistSync: {
        ...(gistId != null && { gistId }),
        ...(gistSyncEnabled != null && { enabled: gistSyncEnabled }),
      },
    },
  };

  return encodeExportData(exportData);
}

export async function prepareImportData(jsonData: string): Promise<PreparedImportData> {
  const data = parseImportData(jsonData);
  validateImportStructure(data);
  const currentSchema = await getCurrentSchemaVersion();
  const preparedData = normalizeImportData(data, currentSchema);

  return {
    ...preparedData,
    dataUpdatedAt: preparedData.dataUpdatedAt ?? new Date().toISOString(),
  };
}

export async function applyImportData(preparedData: PreparedImportData): Promise<void> {
  // Preserve PAT before reset (it's not in export for security)
  const existingPat = await readSyncMetadata('githubPat');

  await resetAllData();

  if (existingPat) {
    await writeSyncMetadata('githubPat', existingPat);
  }

  await writeSnapshotCards(preparedData.cards);

  await saveStats(preparedData.stats);

  await writeSnapshotNotes(preparedData.notes);

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
  const cards = await readSnapshotCards();

  await removeSnapshotCards();
  await removeStats();
  await resetSettings();

  await removeSyncMetadata('githubPat');
  await removeSyncMetadata('gistId');
  await removeSyncMetadata('gistSyncEnabled');
  await removeSyncMetadata('lastSyncTime');
  await removeSyncMetadata('lastSyncDirection');
  await removeSyncMetadata('dataUpdatedAt');

  if (cards) {
    await removeSnapshotNotes(cards);
  }
}
