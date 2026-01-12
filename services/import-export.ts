import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';
import { type StoredCard } from './cards';
import { type DailyStats } from './stats';
import { type Note } from '@/shared/notes';
import { type Theme } from '@/shared/settings';
import { APP_VERSION } from '@/shared/config';

export interface ExportData {
  version: string;
  exportDate: string;
  dataUpdatedAt?: string;
  data: {
    cards: Record<string, StoredCard>;
    stats: Record<string, DailyStats>;
    notes: Record<string, Note>;
    settings: {
      maxNewCardsPerDay?: number;
      animationsEnabled?: boolean;
      theme?: Theme;
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
  // Get all cards to find their notes
  const cardIds = Object.keys(cards);
  for (const cardId of cardIds) {
    const noteKey = `${STORAGE_KEYS.notes}:${cardId}` as const;
    const note = await storage.getItem<Note>(noteKey);
    if (note) {
      notes[cardId] = note;
    }
  }

  // Get settings
  const maxNewCardsPerDay = await storage.getItem<number>(STORAGE_KEYS.maxNewCardsPerDay);
  const animationsEnabled = await storage.getItem<boolean>(STORAGE_KEYS.animationsEnabled);
  const theme = await storage.getItem<Theme>(STORAGE_KEYS.theme);

  // Get gist sync settings
  const gistId = await storage.getItem<string>(STORAGE_KEYS.gistId);
  const gistSyncEnabled = await storage.getItem<boolean>(STORAGE_KEYS.gistSyncEnabled);

  // Get dataUpdatedAt for sync purposes
  const dataUpdatedAt = await storage.getItem<string>(STORAGE_KEYS.dataUpdatedAt);

  const exportData: ExportData = {
    version: APP_VERSION,
    exportDate: new Date().toISOString(),
    dataUpdatedAt: dataUpdatedAt ?? undefined,
    data: {
      cards,
      stats,
      notes,
      settings: {
        ...(maxNewCardsPerDay != null && { maxNewCardsPerDay }),
        ...(animationsEnabled != null && { animationsEnabled }),
        ...(theme != null && { theme }),
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

  // Validate structure
  if (!data.version || !data.exportDate || !data.data) {
    throw new Error('Invalid export data structure');
  }

  if (data.version !== APP_VERSION) {
    throw new Error(`Unsupported export version: ${data.version}. Expected: ${APP_VERSION}`);
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
    if (data.data.settings.animationsEnabled != null) {
      await storage.setItem(STORAGE_KEYS.animationsEnabled, data.data.settings.animationsEnabled);
    }
    if (data.data.settings.theme != null) {
      await storage.setItem(STORAGE_KEYS.theme, data.data.settings.theme);
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
  await storage.removeItem(STORAGE_KEYS.animationsEnabled);
  await storage.removeItem(STORAGE_KEYS.theme);

  // Remove gist sync settings
  await storage.removeItem(STORAGE_KEYS.githubPat);
  await storage.removeItem(STORAGE_KEYS.gistId);
  await storage.removeItem(STORAGE_KEYS.gistSyncEnabled);
  await storage.removeItem(STORAGE_KEYS.lastSyncTime);
  await storage.removeItem(STORAGE_KEYS.lastSyncDirection);
  await storage.removeItem(STORAGE_KEYS.dataUpdatedAt);

  // Remove all notes
  if (cards) {
    for (const cardId of Object.keys(cards)) {
      const noteKey = `${STORAGE_KEYS.notes}:${cardId}` as const;
      await storage.removeItem(noteKey);
    }
  }
}
