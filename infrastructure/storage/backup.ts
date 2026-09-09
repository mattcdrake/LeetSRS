import { z } from 'zod';
import { type Card, cardSchema } from '@/domain/cards';
import type { Note } from '@/domain/notes';
import type { Settings } from '@/domain/settings';
import type { DailyStats } from '@/domain/statistics';

export interface ExportData {
  schemaVersion: number;
  exportDate: string;
  dataUpdatedAt?: string;
  data: {
    cards: Record<string, Card>;
    stats: Record<string, DailyStats>;
    notes: Record<string, Note>;
    settings: Partial<Settings>;
    gistSync?: {
      gistId?: string;
      enabled?: boolean;
    };
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

const count = z.int().nonnegative();
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

const statsSchema = z.object({
  date: calendarDate,
  totalReviews: count,
  newCards: count,
  reviewedCards: count,
  streak: count,
  gradeBreakdown: z.object({ 1: count, 2: count, 3: count, 4: count }),
}) satisfies z.ZodType<DailyStats>;

const noteSchema = z.object({ text: z.string() }) satisfies z.ZodType<Note>;

const backupRecordsSchema = z.object({
  cards: z.record(z.string(), cardSchema),
  stats: z.record(z.string(), statsSchema),
  notes: z.record(z.string(), noteSchema),
});

export function validateBackupRecords(records: unknown) {
  return backupRecordsSchema.parse(records);
}
