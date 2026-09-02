import { storage } from '#imports';
import type { Note } from '@/shared/notes';
import type { Settings } from '@/shared/settings';
import type { StoredCard } from './cards';
import { getCurrentSchemaVersion } from './migrations';
import { exportSettings, resetSettings, updateSettings, validateSettings } from './settings';
import type { DailyStats, MonthlyStats } from './stats';
import { STORAGE_KEYS } from './storage-keys';

export interface ExportData {
  schemaVersion: number;
  exportDate: string;
  dataUpdatedAt?: string;
  data: {
    cards: Record<string, StoredCard>;
    stats: Record<string, DailyStats>;
    monthlyStats?: Record<string, MonthlyStats>;
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
    settings: ExportData['data']['settings'] & { autoClearLeetcode?: boolean };
  };
};

function getImportedSettings(settings: ImportData['data']['settings'] | undefined): Partial<Settings> {
  if (!settings) return {};

  const resetEditorOnEveryProblem = settings.resetEditorOnEveryProblem ?? settings.autoClearLeetcode;
  const { autoClearLeetcode: _, ...currentSettings } = settings;
  return {
    ...currentSettings,
    ...(resetEditorOnEveryProblem != null && { resetEditorOnEveryProblem }),
  };
}

export async function exportData(): Promise<string> {
  // Gather all data from storage
  const cards = (await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards)) ?? {};
  const stats = (await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats)) ?? {};
  const monthlyStats = (await storage.getItem<Record<string, MonthlyStats>>(STORAGE_KEYS.monthlyStats)) ?? {};

  // Get all notes
  const notes: Record<string, Note> = {};
  for (const card of Object.values(cards)) {
    const noteKey = `${STORAGE_KEYS.notes}:${card.id}` as const;
    const note = await storage.getItem<Note>(noteKey);
    if (note) {
      notes[card.id] = note;
    }
  }

  const settings = await exportSettings();

  // Get gist sync settings
  const gistId = await storage.getItem<string>(STORAGE_KEYS.gistId);
  const gistSyncEnabled = await storage.getItem<boolean>(STORAGE_KEYS.gistSyncEnabled);

  // Get dataUpdatedAt for sync purposes
  const dataUpdatedAt = await storage.getItem<string>(STORAGE_KEYS.dataUpdatedAt);

  const schemaVersion = await getCurrentSchemaVersion();

  const exportData: ExportData = {
    schemaVersion,
    exportDate: new Date().toISOString(),
    dataUpdatedAt: dataUpdatedAt ?? undefined,
    data: {
      cards,
      stats,
      ...(Object.keys(monthlyStats).length > 0 && { monthlyStats }),
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

export async function importData(jsonData: string): Promise<void> {
  // Parse and validate JSON
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

  // Check schema version compatibility
  const currentSchema = await getCurrentSchemaVersion();
  const importedSchema = data.schemaVersion ?? 0; // Legacy exports without schemaVersion = 0

  if (importedSchema > currentSchema) {
    throw new Error(`Export is from a newer version (schema ${importedSchema}). Please update the extension.`);
  }

  // Validate data types
  if (typeof data.data.cards !== 'object' || data.data.cards === null) {
    throw new Error('Invalid cards data');
  }

  if (typeof data.data.stats !== 'object' || data.data.stats === null) {
    throw new Error('Invalid stats data');
  }

  if (typeof data.data.notes !== 'object' || data.data.notes === null) {
    throw new Error('Invalid notes data');
  }

  // Validate settings before resetting existing data.
  const importedSettings = getImportedSettings(data.data.settings);
  validateSettings(importedSettings);

  // Preserve PAT before reset (it's not in export for security)
  const existingPat = await storage.getItem<string>(STORAGE_KEYS.githubPat);

  // Clear existing data for a clean import
  await resetAllData();

  // Restore PAT if it existed
  if (existingPat) {
    await storage.setItem(STORAGE_KEYS.githubPat, existingPat);
  }

  // Import cards
  await storage.setItem(STORAGE_KEYS.cards, data.data.cards);

  // Import stats
  await storage.setItem(STORAGE_KEYS.stats, data.data.stats);

  // Import monthly stats
  if (data.data.monthlyStats) {
    await storage.setItem(STORAGE_KEYS.monthlyStats, data.data.monthlyStats);
  }

  // Import notes
  for (const [cardId, note] of Object.entries(data.data.notes)) {
    const key = `${STORAGE_KEYS.notes}:${cardId}` as const;
    await storage.setItem(key, note);
  }

  // Import settings
  if (data.data.settings) {
    await updateSettings(importedSettings);
  }

  // Import gist sync settings
  if (data.data.gistSync) {
    if (data.data.gistSync.gistId != null) {
      await storage.setItem(STORAGE_KEYS.gistId, data.data.gistSync.gistId);
    }
    if (data.data.gistSync.enabled != null) {
      await storage.setItem(STORAGE_KEYS.gistSyncEnabled, data.data.gistSync.enabled);
    }
  }

  // Import dataUpdatedAt if present, otherwise set to now
  await storage.setItem(STORAGE_KEYS.dataUpdatedAt, data.dataUpdatedAt ?? new Date().toISOString());
}

export async function resetAllData(): Promise<void> {
  // Get all cards first to know which notes to remove
  const cards = await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards);

  // Remove all data
  await storage.removeItem(STORAGE_KEYS.cards);
  await storage.removeItem(STORAGE_KEYS.stats);
  await storage.removeItem(STORAGE_KEYS.monthlyStats);
  await resetSettings();

  // Remove gist sync settings
  await storage.removeItem(STORAGE_KEYS.githubPat);
  await storage.removeItem(STORAGE_KEYS.gistId);
  await storage.removeItem(STORAGE_KEYS.gistSyncEnabled);
  await storage.removeItem(STORAGE_KEYS.lastSyncTime);
  await storage.removeItem(STORAGE_KEYS.lastSyncDirection);
  await storage.removeItem(STORAGE_KEYS.dataUpdatedAt);

  // Remove all notes
  if (cards) {
    for (const card of Object.values(cards)) {
      const noteKey = `${STORAGE_KEYS.notes}:${card.id}` as const;
      await storage.removeItem(noteKey);
    }
  }
}
