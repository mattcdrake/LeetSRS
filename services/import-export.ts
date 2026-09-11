import type { ExportData, PreparedImportData } from '@/infrastructure/storage/backup';
import { parseBackup } from '@/infrastructure/storage/backup';
import { getAllCards, removeCards, saveCards } from '@/infrastructure/storage/cards';
import { LATEST_SCHEMA_VERSION } from '@/infrastructure/storage/migrations/runner';
import { deleteNote, getNotesForCards, saveNote } from '@/infrastructure/storage/notes';
import { getStats, removeStats, saveStats } from '@/infrastructure/storage/stats';
import { readSyncMetadata, removeSyncMetadata, writeSyncMetadata } from '@/infrastructure/storage/sync-metadata';
import { getGitHubPat, removeGitHubPat, setGitHubPat } from './github-auth';
import { exportSettings, resetSettings, updateSettings } from './settings';

export async function exportData(): Promise<string> {
  const cardsPromise = getAllCards();
  const [cards, stats, notes, settings, gistId, gistSyncEnabled, dataUpdatedAt] = await Promise.all([
    cardsPromise,
    getStats(),
    cardsPromise.then((cards) => getNotesForCards(cards)),
    exportSettings(),
    readSyncMetadata('gistId'),
    readSyncMetadata('gistSyncEnabled'),
    readSyncMetadata('dataUpdatedAt'),
  ]);

  const exportData: ExportData = {
    schemaVersion: LATEST_SCHEMA_VERSION,
    exportDate: new Date().toISOString(),
    dataUpdatedAt: dataUpdatedAt ?? undefined,
    data: {
      cards: Object.fromEntries(cards.map((card) => [card.slug, card])),
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
  return parseBackup(jsonData);
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
  for (const [cardId, note] of Object.entries(preparedData.notes)) {
    await saveNote(cardId, note.text);
  }
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
  const cards = await getAllCards();
  await removeCards();
  await removeStats();
  await resetSettings();
  await removeGitHubPat();
  await removeSyncMetadata('gistId');
  await removeSyncMetadata('gistSyncEnabled');
  await removeSyncMetadata('lastSyncTime');
  await removeSyncMetadata('lastSyncDirection');
  await removeSyncMetadata('dataUpdatedAt');

  for (const card of cards) {
    await deleteNote(card.id);
  }
}
