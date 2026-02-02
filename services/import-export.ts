import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';
import { type StoredCard } from './cards';
import { type DailyStats } from './stats';
import { type Note } from '@/shared/notes';
import { type Theme } from '@/shared/settings';
import { getCurrentSchemaVersion } from './migrations';

export interface ExportData {
  schemaVersion: number;
  exportDate: string;
  dataUpdatedAt?: string;
  data: {
    cards: Record<string, StoredCard>;
    stats: Record<string, DailyStats>;
    notes: Record<string, Note>;
    settings: {
      maxNewCardsPerDay?: number;
      dayStartHour?: number;
      animationsEnabled?: boolean;
      theme?: Theme;
      autoClearLeetcode?: boolean;
    };
    gistSync?: {
      gistId?: string;
      enabled?: boolean;
    };
  };
}

export async function exportData(): Promise<string> {
  // Gather all data from storage
  const cards = (await storage.getItem<Record<string, StoredCard>>(STORAGE_KEYS.cards)) ?? {};
  const stats = (await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats)) ?? {};

  // Get all notes
  const notes: Record<string, Note> = {};
  for (const card of Object.values(cards)) {
    const noteKey = `${STORAGE_KEYS.notes}:${card.id}` as const;
    const note = await storage.getItem<Note>(noteKey);
    if (note) {
      notes[card.id] = note;
    }
  }

  // Get settings
  const maxNewCardsPerDay = await storage.getItem<number>(STORAGE_KEYS.maxNewCardsPerDay);
  const dayStartHour = await storage.getItem<number>(STORAGE_KEYS.dayStartHour);
  const animationsEnabled = await storage.getItem<boolean>(STORAGE_KEYS.animationsEnabled);
  const theme = await storage.getItem<Theme>(STORAGE_KEYS.theme);
  const autoClearLeetcode = await storage.getItem<boolean>(STORAGE_KEYS.autoClearLeetcode);

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
      notes,
      settings: {
        ...(maxNewCardsPerDay != null && { maxNewCardsPerDay }),
        ...(dayStartHour != null && { dayStartHour }),
        ...(animationsEnabled != null && { animationsEnabled }),
        ...(theme != null && { theme }),
        ...(autoClearLeetcode != null && { autoClearLeetcode }),
      },
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
  let data: ExportData;
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

  // Import notes
  for (const [cardId, note] of Object.entries(data.data.notes)) {
    const key = `${STORAGE_KEYS.notes}:${cardId}` as const;
    await storage.setItem(key, note);
  }

  // Import settings
  if (data.data.settings) {
    if (data.data.settings.maxNewCardsPerDay != null) {
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, data.data.settings.maxNewCardsPerDay);
    }
    if (data.data.settings.dayStartHour != null) {
      await storage.setItem(STORAGE_KEYS.dayStartHour, data.data.settings.dayStartHour);
    }
    if (data.data.settings.animationsEnabled != null) {
      await storage.setItem(STORAGE_KEYS.animationsEnabled, data.data.settings.animationsEnabled);
    }
    if (data.data.settings.theme != null) {
      await storage.setItem(STORAGE_KEYS.theme, data.data.settings.theme);
    }
    if (data.data.settings.autoClearLeetcode != null) {
      await storage.setItem(STORAGE_KEYS.autoClearLeetcode, data.data.settings.autoClearLeetcode);
    }
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
  await storage.removeItem(STORAGE_KEYS.maxNewCardsPerDay);
  await storage.removeItem(STORAGE_KEYS.dayStartHour);
  await storage.removeItem(STORAGE_KEYS.animationsEnabled);
  await storage.removeItem(STORAGE_KEYS.theme);
  await storage.removeItem(STORAGE_KEYS.autoClearLeetcode);

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
