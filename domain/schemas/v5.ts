import { z } from 'zod';

export const gistConnectionSchema = z.object({
  pat: z.string(),
  gistId: z.string().nullable(),
  enabled: z.boolean(),
});
