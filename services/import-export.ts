import { storage } from '#imports';
import { normalizeImportData, validateImportStructure } from '@/domain/backup-import';
import type { Note } from '@/domain/notes';
import type { DailyStats } from '@/domain/stats';
import {
  type ExportData,
  encodeExportData,
  type PreparedImportData,
  parseImportData,
} from '@/infrastructure/storage/backup-codec';
import type { StoredCard } from '@/infrastructure/storage/card-codec';
import { getCurrentSchemaVersion } from '@/infrastructure/storage/migrations';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { exportSettings, resetSettings, updateSettings } from './settings';

export async function exportData(): Promise<string> {
  const cards = (await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards)) ?? {};
  const stats = (await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats)) ?? {};

  const notes: Record<string, Note> = {};
  for (const card of Object.values(cards)) {
    const noteKey = `${STORAGE_KEYS.notes}:${card.id}` as const;
    const note = await storage.getItem<Note>(noteKey);
    if (note) {
      notes[card.id] = note;
    }
  }

  const settings = await exportSettings();

  const gistId = await storage.getItem<string>(STORAGE_KEYS.gistId);
  const gistSyncEnabled = await storage.getItem<boolean>(STORAGE_KEYS.gistSyncEnabled);

  const dataUpdatedAt = await storage.getItem<string>(STORAGE_KEYS.dataUpdatedAt);

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
  const existingPat = await storage.getItem<string>(STORAGE_KEYS.githubPat);

  await resetAllData();

  if (existingPat) {
    await storage.setItem(STORAGE_KEYS.githubPat, existingPat);
  }

  await storage.setItem(STORAGE_KEYS.cards, preparedData.cards);

  await storage.setItem(STORAGE_KEYS.stats, preparedData.stats);

  for (const [cardId, note] of Object.entries(preparedData.notes)) {
    const key = `${STORAGE_KEYS.notes}:${cardId}` as const;
    await storage.setItem(key, note);
  }

  await updateSettings(preparedData.settings);

  if (preparedData.gistSync) {
    if (preparedData.gistSync.gistId != null) {
      await storage.setItem(STORAGE_KEYS.gistId, preparedData.gistSync.gistId);
    }
    if (preparedData.gistSync.enabled != null) {
      await storage.setItem(STORAGE_KEYS.gistSyncEnabled, preparedData.gistSync.enabled);
    }
  }

  await storage.setItem(STORAGE_KEYS.dataUpdatedAt, preparedData.dataUpdatedAt);
}

export async function importData(jsonData: string): Promise<void> {
  const preparedData = await prepareImportData(jsonData);
  await applyImportData(preparedData);
}

export async function resetAllData(): Promise<void> {
  const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);

  await storage.removeItem(STORAGE_KEYS.cards);
  await storage.removeItem(STORAGE_KEYS.stats);
  await resetSettings();

  await storage.removeItem(STORAGE_KEYS.githubPat);
  await storage.removeItem(STORAGE_KEYS.gistId);
  await storage.removeItem(STORAGE_KEYS.gistSyncEnabled);
  await storage.removeItem(STORAGE_KEYS.lastSyncTime);
  await storage.removeItem(STORAGE_KEYS.lastSyncDirection);
  await storage.removeItem(STORAGE_KEYS.dataUpdatedAt);

  if (cards) {
    for (const card of Object.values(cards)) {
      const noteKey = `${STORAGE_KEYS.notes}:${card.id}` as const;
      await storage.removeItem(noteKey);
    }
  }
}
