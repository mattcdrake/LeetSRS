import { browser } from 'wxt/browser';
import { z } from 'zod';
import type { CatalogProblem } from '@/shared/catalog';
import type { Card, LearningDocument } from '@/shared/learning-document';
import type { LeetcodeDomain } from '@/shared/leetcode-domain';

export const ROADMAP_IDS = ['blind-75', 'neetcode-150', 'neetcode-250', 'grind-75'] as const;
export const roadmapIdSchema = z.enum(ROADMAP_IDS);
export type RoadmapId = z.infer<typeof roadmapIdSchema>;

export const roadmapSkipsSchema = z.partialRecord(roadmapIdSchema, z.array(z.string().min(1)));

export const roadmapSchema = z.object({
  id: roadmapIdSchema,
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

export async function loadRoadmap(id: RoadmapId): Promise<Roadmap> {
  const response = await fetch(browser.runtime.getURL(`/data/roadmaps/${id}.json`));
  if (!response.ok) throw new Error(`Failed to load roadmap: ${response.status}`);
  return roadmapSchema.parse(await response.json());
}

export function roadmapProblemIds(roadmap: Roadmap): string[] {
  return roadmap.groups.flatMap((group) => group.frontendIds);
}

export function isReviewed(card: Card | undefined): boolean {
  return !!card && card.fsrs.reps > 0;
}

export interface RoadmapProgressSummary {
  total: number;
  reviewed: number;
  /** In SRS but not reviewed yet. */
  new: number;
  /** Skipped and not in SRS, so the three counts never overlap. */
  skipped: number;
}

export function summarizeRoadmap(
  document: LearningDocument,
  ids: readonly string[],
  skippedIds: readonly string[] = []
): RoadmapProgressSummary {
  const skipped = new Set(skippedIds);
  const summary = { total: ids.length, reviewed: 0, new: 0, skipped: 0 };
  for (const id of ids) {
    const card = document.cards[id];
    if (isReviewed(card)) summary.reviewed++;
    else if (card) summary.new++;
    else if (skipped.has(id)) summary.skipped++;
  }
  return summary;
}

export function getNextRoadmapProblemId(
  roadmap: Roadmap,
  document: LearningDocument,
  metadata: Record<string, CatalogProblem | undefined> | undefined,
  domain: LeetcodeDomain,
  currentId?: string
): string | undefined {
  const skippedIds = new Set(document.roadmapSkips[roadmap.id]);
  return roadmapProblemIds(roadmap).find(
    (id) => id !== currentId && !document.cards[id] && !skippedIds.has(id) && metadata?.[id]?.sources.includes(domain)
  );
}
