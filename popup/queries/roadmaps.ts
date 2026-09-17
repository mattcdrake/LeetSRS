import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { browser } from 'wxt/browser';
import { storage } from '#imports';
import { type CatalogProblem, getProblemsByFrontendIds } from '@/shared/catalog';
import type { LeetcodeDomain } from '@/shared/models';
import {
  ROADMAP_IDS,
  type Roadmap,
  type RoadmapId,
  roadmapIdSchema,
  roadmapSchema,
  roadmapSkipsSchema,
} from '@/shared/roadmap';
import { STORAGE_KEYS } from '@/shared/storage';

export const activeRoadmapQueryOptions = queryOptions({
  queryKey: ['popupActiveRoadmap'],
  queryFn: async () => roadmapIdSchema.nullable().parse(await storage.getItem(STORAGE_KEYS.activeRoadmapId)),
});

export function useActivateRoadmapMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: RoadmapId | null) => storage.setItem(STORAGE_KEYS.activeRoadmapId, id),
    onSettled: () => client.invalidateQueries({ queryKey: activeRoadmapQueryOptions.queryKey }),
  });
}

async function readRoadmapSkips() {
  return roadmapSkipsSchema.parse((await storage.getItem(STORAGE_KEYS.roadmapSkips)) ?? {});
}

export const roadmapSkipsQueryOptions = queryOptions({
  queryKey: ['popupRoadmapSkips'],
  queryFn: readRoadmapSkips,
});

export function useSkipRoadmapProblemMutation() {
  const client = useQueryClient();
  return useMutation({
    scope: { id: 'roadmapSkips' },
    mutationFn: async ({
      roadmapId,
      frontendId,
      skipped,
    }: {
      roadmapId: RoadmapId;
      frontendId: string;
      skipped: boolean;
    }) => {
      const skips = await readRoadmapSkips();
      const ids = new Set(skips[roadmapId]);
      if (skipped) {
        ids.add(frontendId);
      } else {
        ids.delete(frontendId);
      }
      await storage.setItem(STORAGE_KEYS.roadmapSkips, { ...skips, [roadmapId]: [...ids] });
    },
    onSettled: () => client.invalidateQueries({ queryKey: roadmapSkipsQueryOptions.queryKey }),
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
