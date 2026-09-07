import type { Note } from '@/domain/notes';
import type { Settings } from '@/domain/settings';
import type { DailyStats } from '@/domain/statistics';
import type { StoredCard } from '@/infrastructure/storage/cards/codec';

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

export type ImportData = Omit<ExportData, 'data'> & {
  data: Omit<ExportData['data'], 'settings'> & {
    settings: ExportData['data']['settings'] & {
      animationsEnabled?: boolean;
      autoClearLeetcode?: boolean;
    };
  };
};

export type PreparedImportData = {
  cards: Record<string, StoredCard>;
  stats: Record<string, DailyStats>;
  notes: Record<string, Note>;
  settings: Partial<Settings>;
  gistSync?: ExportData['data']['gistSync'];
  dataUpdatedAt: string;
};

export function encodeExportData(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function parseImportData(jsonData: string): ImportData {
  let data: ImportData;
  try {
    data = JSON.parse(jsonData);
  } catch {
    throw new Error('Invalid JSON format');
  }

  return data;
}
