import { z } from 'zod';
import { timestampSchema } from './001-add-card-domain';

export const legacyBackupSchema = z.object({
  schemaVersion: z.int().nonnegative().default(0),
  exportDate: timestampSchema,
  dataUpdatedAt: timestampSchema.optional(),
  data: z.looseObject({
    cards: z.record(z.string(), z.unknown()),
    stats: z.record(z.string(), z.unknown()),
    gistSync: z.object({ gistId: z.string(), enabled: z.boolean() }).partial().optional(),
  }),
});
