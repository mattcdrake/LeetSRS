import { z } from 'zod';

// Version 5 device-local connection contract. Keep fixed for historical migrations.
export const gistConnectionSchema = z.object({
  pat: z.string(),
  gistId: z.string().nullable(),
  enabled: z.boolean(),
});
