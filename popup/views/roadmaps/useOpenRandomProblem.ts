import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import { roadmapMetadataQueryOptions } from '@/popup/queries/roadmaps';
import { useSettingsQuery } from '@/popup/queries/settings';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import { getRecommendableRoadmapProblemIds, pickRandomRoadmapProblemId, type Roadmap } from '@/shared/roadmap';

/** Opens a random recommendable roadmap problem in a new tab; undefined while none is available. */
export function useOpenRandomProblem(roadmap: Roadmap): (() => void) | undefined {
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const { data: settings } = useSettingsQuery();
  const domain = settings.preferredLeetcodeSite;
  const metadata = useQuery(roadmapMetadataQueryOptions(roadmap, domain));
  const ids = getRecommendableRoadmapProblemIds(roadmap, document, metadata.data, domain);
  if (ids.length === 0) return undefined;

  return () => {
    const id = pickRandomRoadmapProblemId(ids);
    const problem = id ? metadata.data?.[id] : undefined;
    if (problem) window.open(getLeetcodeProblemUrl({ domain, slug: problem.slug }), '_blank', 'noopener,noreferrer');
  };
}
