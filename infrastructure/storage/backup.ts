import { z } from 'zod';
import { backupMetadataSchema } from '@/domain/backup-import';
import { cardSchema } from '@/domain/cards';
import { gistSyncBackupSchema } from '@/domain/gist-sync';
import { noteSchema } from '@/domain/notes';
import { settingsUpdateSchema } from '@/domain/settings';
import { dailyStatsSchema } from '@/domain/statistics';

const backupRecordsSchema = z.object({
  cards: z.record(z.string(), cardSchema),
  stats: z.record(z.string(), dailyStatsSchema),
  notes: z.record(z.string(), noteSchema),
});

export const exportDataSchema = backupMetadataSchema.extend({
  data: backupRecordsSchema.extend({
    settings: settingsUpdateSchema,
    gistSync: gistSyncBackupSchema.optional(),
  }),
});
export type ExportData = z.infer<typeof exportDataSchema>;

export type PreparedImportData = ExportData['data'] & {
  dataUpdatedAt: NonNullable<ExportData['dataUpdatedAt']>;
};

export function validateBackupRecords(records: unknown) {
  return backupRecordsSchema.parse(records);
}
