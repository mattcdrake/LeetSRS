import { z } from 'zod';

export const roadmapSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sourceUrl: z.url(),
  groups: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        frontendIds: z.array(z.string().min(1)).min(1),
      })
    )
    .min(1),
});
