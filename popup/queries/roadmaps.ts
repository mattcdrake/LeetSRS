import { queryOptions } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import { type CatalogProblem, getProblemsByFrontendIds } from '@/shared/catalog';
import type { LearningDocument } from '@/shared/learning-document';
import type { LeetcodeDomain } from '@/shared/leetcode-domain';
import { loadRoadmap, ROADMAP_IDS, type Roadmap, type RoadmapId, roadmapProblemIds } from '@/shared/roadmap';
import { learningDocumentQueryOptions, useDocumentMutation } from './learning-document';

export const activeRoadmapQueryOptions = queryOptions({
  ...learningDocumentQueryOptions,
  select: (document: LearningDocument) => document.activeRoadmapId,
});

export function useActivateRoadmapMutation() {
  return useDocumentMutation((id: RoadmapId | null) => background.setActiveRoadmap(id));
}

export const roadmapSkipsQueryOptions = queryOptions({
  ...learningDocumentQueryOptions,
  select: (document: LearningDocument) => document.roadmapSkips,
});

export function useSkipRoadmapProblemMutation() {
  return useDocumentMutation(
    ({ roadmapId, frontendId, skipped }: { roadmapId: RoadmapId; frontendId: string; skipped: boolean }) =>
      background.setRoadmapProblemSkipped(roadmapId, frontendId, skipped),
    { scope: { id: 'roadmapSkips' } }
  );
}

export function roadmapMetadataQueryOptions(roadmap: Roadmap, domain: LeetcodeDomain) {
  return queryOptions({
    queryKey: ['popupRoadmapMetadata', roadmap.id, domain],
    staleTime: Infinity,
    queryFn: async () => {
      const ids = roadmapProblemIds(roadmap);
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
  queryFn: () => Promise.all(ROADMAP_IDS.map(loadRoadmap)),
});
