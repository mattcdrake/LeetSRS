import { z } from 'zod';
import { type Card, cardSchema } from '@/domain/cards';
import type { GistSyncBackup } from '@/domain/gist-sync';
import { type Note, noteSchema } from '@/domain/notes';
import type { Settings } from '@/domain/settings';
import { type DailyStats, dailyStatsSchema } from '@/domain/statistics';

export interface ExportData {
  schemaVersion: number;
  exportDate: string;
  dataUpdatedAt?: string;
  data: {
    cards: Record<string, Card>;
    stats: Record<string, DailyStats>;
    notes: Record<string, Note>;
    settings: Partial<Settings>;
    gistSync?: GistSyncBackup;
  };
}

export type PreparedImportData = {
  cards: Record<string, Card>;
  stats: Record<string, DailyStats>;
  notes: Record<string, Note>;
  settings: Partial<Settings>;
  gistSync?: ExportData['data']['gistSync'];
  dataUpdatedAt: string;
};

const backupRecordsSchema = z.object({
  cards: z.record(z.string(), cardSchema),
  stats: z.record(z.string(), dailyStatsSchema),
  notes: z.record(z.string(), noteSchema),
});

export function validateBackupRecords(records: unknown) {
  return backupRecordsSchema.parse(records);
}
