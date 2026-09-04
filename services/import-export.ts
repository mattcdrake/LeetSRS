import { storage } from '#imports';
import type { Note } from '@/shared/notes';
import type { Settings } from '@/shared/settings';
import type { DailyStats } from '@/shared/stats';
import type { StoredCard } from './cards';
import { getCurrentSchemaVersion } from './migrations';
import { exportSettings, resetSettings, updateSettings, validateSettings } from './settings';
import { STORAGE_KEYS } from './storage-keys';

export interface ExportData {
  schemaVersion: number;
  exportDate: string;
  dataUpdatedAt?: string;
  data: {
    cards: Record<string, StoredCard>;
    stats: Record<string, DailyStats>;
    notes: Record<string, Note>;
    settings: Partial<Settings>;
    gistSync?: {
      gistId?: string;
      enabled?: boolean;
    };
  };
}

type ImportData = Omit<ExportData, 'data'> & {
  data: Omit<ExportData['data'], 'settings'> & {
    settings: ExportData['data']['settings'] & {
      animationsEnabled?: boolean;
      autoClearLeetcode?: boolean;
    };
  };
};

type PreparedImportData = {
  cards: Record<string, StoredCard>;
  stats: Record<string, DailyStats>;
  notes: Record<string, Note>;
  settings: Partial<Settings>;
  gistSync?: ExportData['data']['gistSync'];
  dataUpdatedAt: string;
};

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

  return JSON.stringify(exportData, null, 2);
}

function getImportedSettings(settings: ImportData['data']['settings'] | undefined): Partial<Settings> {
  if (!settings) return {};

  const resetEditorOnEveryProblem = settings.resetEditorOnEveryProblem ?? settings.autoClearLeetcode;
  const { animationsEnabled: _animationsEnabled, autoClearLeetcode: _autoClearLeetcode, ...currentSettings } = settings;
  return {
    ...currentSettings,
    ...(resetEditorOnEveryProblem != null && { resetEditorOnEveryProblem }),
  };
}

export async function prepareImportData(jsonData: string): Promise<PreparedImportData> {
  let data: ImportData;
  try {
    data = JSON.parse(jsonData);
  } catch {
    throw new Error('Invalid JSON format');
  }

  // Validate structure (schemaVersion is optional for backward compat with legacy exports)
  if (!data.exportDate || !data.data) {
    throw new Error('Invalid export data structure');
  }

  const currentSchema = await getCurrentSchemaVersion();
  const importedSchema = data.schemaVersion ?? 0; // Legacy exports without schemaVersion = 0

  if (importedSchema > currentSchema) {
    throw new Error(`Export is from a newer version (schema ${importedSchema}). Please update the extension.`);
  }

  if (typeof data.data.cards !== 'object' || data.data.cards === null) {
    throw new Error('Invalid cards data');
  }

  if (typeof data.data.stats !== 'object' || data.data.stats === null) {
    throw new Error('Invalid stats data');
  }

  if (typeof data.data.notes !== 'object' || data.data.notes === null) {
    throw new Error('Invalid notes data');
  }

  const importedSettings = getImportedSettings(data.data.settings);
  validateSettings(importedSettings);

  return {
    cards: data.data.cards,
    stats: data.data.stats,
    notes: data.data.notes,
    settings: importedSettings,
    gistSync: data.data.gistSync,
    dataUpdatedAt: data.dataUpdatedAt ?? new Date().toISOString(),
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
