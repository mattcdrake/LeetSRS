import { normalizeImportData, validateImportStructure } from '@/domain/backup-import';
import {
  type ExportData,
  encodeExportData,
  type PreparedImportData,
  parseImportData,
} from '@/infrastructure/storage/backup-codec';
import { getCurrentSchemaVersion } from '@/infrastructure/storage/migrations';
import {
  readSnapshotCards,
  readSnapshotMetadata,
  readSnapshotNotes,
  removeSnapshotCards,
  removeSnapshotMetadata,
  removeSnapshotNotes,
  writeSnapshotCards,
  writeSnapshotMetadata,
  writeSnapshotNotes,
} from '@/infrastructure/storage/snapshot';
import { getStats, removeStats, saveStats } from '@/infrastructure/storage/stats';
import { exportSettings, resetSettings, updateSettings } from './settings';

export async function exportData(): Promise<string> {
  const cards = (await readSnapshotCards()) ?? {};
  const stats = await getStats();
  const notes = await readSnapshotNotes(cards);

  const settings = await exportSettings();

  const gistId = await readSnapshotMetadata('gistId');
  const gistSyncEnabled = await readSnapshotMetadata('gistSyncEnabled');

  const dataUpdatedAt = await readSnapshotMetadata('dataUpdatedAt');

  const schemaVersion = await getCurrentSchemaVersion();

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
  const existingPat = await readSnapshotMetadata('githubPat');

  await resetAllData();

  if (existingPat) {
    await writeSnapshotMetadata('githubPat', existingPat);
  }

  await writeSnapshotCards(preparedData.cards);

  await saveStats(preparedData.stats);

  await writeSnapshotNotes(preparedData.notes);

  await updateSettings(preparedData.settings);

  if (preparedData.gistSync) {
    if (preparedData.gistSync.gistId != null) {
      await writeSnapshotMetadata('gistId', preparedData.gistSync.gistId);
    }
    if (preparedData.gistSync.enabled != null) {
      await writeSnapshotMetadata('gistSyncEnabled', preparedData.gistSync.enabled);
    }
  }

  await writeSnapshotMetadata('dataUpdatedAt', preparedData.dataUpdatedAt);
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

  await removeSnapshotMetadata('githubPat');
  await removeSnapshotMetadata('gistId');
  await removeSnapshotMetadata('gistSyncEnabled');
  await removeSnapshotMetadata('lastSyncTime');
  await removeSnapshotMetadata('lastSyncDirection');
  await removeSnapshotMetadata('dataUpdatedAt');

  if (cards) {
    await removeSnapshotNotes(cards);
  }
}
