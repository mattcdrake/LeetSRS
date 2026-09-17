import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { browser } from 'wxt/browser';
import { background } from '@/shared/background-service';
import { type CatalogProblem, getProblemsByFrontendIds } from '@/shared/catalog';
import type { LearningDocument, LeetcodeDomain } from '@/shared/models';
import { ROADMAP_IDS, type Roadmap, type RoadmapId, roadmapSchema } from '@/shared/roadmap';
import { learningDocumentQueryKey, learningDocumentQueryOptions } from './learning-document';

export const activeRoadmapQueryOptions = queryOptions({
  ...learningDocumentQueryOptions,
  select: (document: LearningDocument) => document.activeRoadmapId,
});

export function useActivateRoadmapMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: RoadmapId | null) => background.setActiveRoadmap(id),
    onSettled: () => client.invalidateQueries({ queryKey: learningDocumentQueryKey }),
  });
}

export const roadmapSkipsQueryOptions = queryOptions({
  ...learningDocumentQueryOptions,
  select: (document: LearningDocument) => document.roadmapSkips,
});

export function useSkipRoadmapProblemMutation() {
  const client = useQueryClient();
  return useMutation({
    scope: { id: 'roadmapSkips' },
    mutationFn: ({ roadmapId, frontendId, skipped }: { roadmapId: RoadmapId; frontendId: string; skipped: boolean }) =>
      background.setRoadmapProblemSkipped(roadmapId, frontendId, skipped),
    onSettled: () => client.invalidateQueries({ queryKey: learningDocumentQueryKey }),
  });
}

export function roadmapMetadataQueryOptions(roadmap: Roadmap, domain: LeetcodeDomain) {
  return queryOptions({
    queryKey: ['popupRoadmapMetadata', roadmap.id, domain],
    staleTime: Infinity,
    queryFn: async () => {
      const ids = roadmap.groups.flatMap((group) => group.frontendIds);
      const problems = await getProblemsByFrontendIds(ids.map((frontendId) => ({ frontendId, domain })));

      // Retain titles and paid status for unavailable rows; links still use the preferred site.
      const unavailableIds = ids.filter((_, index) => !problems[index]);
      const fallback = await getProblemsByFrontendIds(
        unavailableIds.map((frontendId) => ({
          frontendId,
          domain: domain === 'leetcode.com' ? 'leetcode.cn' : 'leetcode.com',
        }))
      );
      return Object.fromEntries<CatalogProblem | undefined>([
        ...ids.map((id, index) => [id, problems[index]] as const),
        ...unavailableIds.map((id, index) => [id, fallback[index]] as const),
      ]);
    },
  });
}

export const roadmapsQueryOptions = queryOptions({
  queryKey: ['popupRoadmaps'],
  staleTime: Infinity,
  queryFn: () =>
    Promise.all(
      ROADMAP_IDS.map(async (id) => {
        const response = await fetch(browser.runtime.getURL(`/data/roadmaps/${id}.json`));
        if (!response.ok) throw new Error(`Failed to load roadmap: ${response.status}`);
        return { ...roadmapSchema.parse(await response.json()), id };
      })
    ),
});
