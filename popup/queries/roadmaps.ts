import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { browser } from 'wxt/browser';
import { storage } from '#imports';
import { ROADMAP_IDS, type RoadmapId, roadmapIdSchema, roadmapSchema } from '@/shared/roadmap';
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
