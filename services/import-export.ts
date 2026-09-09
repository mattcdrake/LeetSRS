import { normalizeImportData, validateImportStructure } from '@/domain/backup-import';
import type { ExportData, PreparedImportData } from '@/infrastructure/storage/backup';
import {
  readSnapshotCards,
  readSnapshotNotes,
  removeSnapshotCards,
  removeSnapshotNotes,
  writeSnapshotCards,
  writeSnapshotNotes,
} from '@/infrastructure/storage/backup';
import { getCurrentSchemaVersion, migrateBackupData } from '@/infrastructure/storage/migrations';
import { getStats, removeStats, saveStats } from '@/infrastructure/storage/stats';
import { readSyncMetadata, removeSyncMetadata, writeSyncMetadata } from '@/infrastructure/storage/sync-metadata';
import { getGitHubPat, removeGitHubPat, setGitHubPat } from './github-auth';
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
  const preparedData = migrateBackupData(normalizedData, schemaVersion);

  return {
    ...preparedData,
    // Only collection shapes are validated here; Record filtering — Step 2 in todo.md will validate their records.
    cards: preparedData.cards as PreparedImportData['cards'],
    stats: preparedData.stats as PreparedImportData['stats'],
    notes: preparedData.notes as PreparedImportData['notes'],
    dataUpdatedAt: preparedData.dataUpdatedAt ?? new Date().toISOString(),
  };
}

export async function applyImportData(preparedData: PreparedImportData): Promise<void> {
  // Preserve PAT before reset (it's not in export for security)
  const existingPat = await getGitHubPat();
  await resetAllData();

  if (existingPat) {
    await setGitHubPat(existingPat);
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
  await removeGitHubPat();
  await removeSyncMetadata('gistId');
  await removeSyncMetadata('gistSyncEnabled');
  await removeSyncMetadata('lastSyncTime');
  await removeSyncMetadata('lastSyncDirection');
  await removeSyncMetadata('dataUpdatedAt');

  if (cards) {
    await removeSnapshotNotes(cards);
  }
}
