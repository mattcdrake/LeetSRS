import { browser } from 'wxt/browser';
import { z } from 'zod';
import type { CatalogProblem } from '@/shared/catalog';
import type { LearningDocument, LeetcodeDomain } from '@/shared/models';

export const ROADMAP_IDS = ['blind-75', 'neetcode-150', 'neetcode-250', 'grind-75'] as const;
export const roadmapIdSchema = z.enum(ROADMAP_IDS);
export type RoadmapId = z.infer<typeof roadmapIdSchema>;

export const roadmapSkipsSchema = z.partialRecord(roadmapIdSchema, z.array(z.string().min(1)));

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

export async function loadRoadmap(id: RoadmapId): Promise<Roadmap & { id: RoadmapId }> {
  const response = await fetch(browser.runtime.getURL(`/data/roadmaps/${id}.json`));
  if (!response.ok) throw new Error(`Failed to load roadmap: ${response.status}`);
  return { ...roadmapSchema.parse(await response.json()), id };
}

export function getNextRoadmapProblemId(
  roadmap: Roadmap & { id: RoadmapId },
  document: LearningDocument,
  metadata: Record<string, CatalogProblem | undefined> | undefined,
  domain: LeetcodeDomain,
  currentId?: string
): string | undefined {
  const skippedIds = new Set(document.roadmapSkips[roadmap.id]);
  return roadmap.groups
    .flatMap((group) => group.frontendIds)
    .find(
      (id) => id !== currentId && !document.cards[id] && !skippedIds.has(id) && metadata?.[id]?.sources.includes(domain)
    );
}
