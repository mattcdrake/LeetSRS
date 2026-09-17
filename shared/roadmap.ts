import { z } from 'zod';

export const ROADMAP_IDS = ['blind-75', 'neetcode-150', 'neetcode-250', 'grind-75'] as const;
export const roadmapIdSchema = z.enum(ROADMAP_IDS);
export type RoadmapId = z.infer<typeof roadmapIdSchema>;

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

export type Roadmap = z.infer<typeof roadmapSchema>;
