import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useI18n } from '@/popup/contexts/I18nContext';
import { useAddCardMutation } from '@/popup/queries/cards';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import {
  roadmapMetadataQueryOptions,
  roadmapSkipsQueryOptions,
  useSkipRoadmapProblemMutation,
} from '@/popup/queries/roadmaps';
import { useSettingsQuery } from '@/popup/queries/settings';
import type { LeetcodeDomain } from '@/shared/models';
import { getProblemTitle } from '@/shared/ui/problem-title';
import { RoadmapGroup } from './RoadmapGroup';
import type { RoadmapSummary } from './RoadmapOverview';
import { type RoadmapProblem, RoadmapProblemRow } from './RoadmapProblemRow';

export type RoadmapFilter = 'notInSrs' | 'inSrs' | 'reviewed' | 'skipped';

function matchesFilter({ card, skipped }: RoadmapProblem, filter: RoadmapFilter | null): boolean {
  switch (filter) {
    case 'notInSrs':
      return !card;
    case 'inSrs':
      return !!card;
    case 'reviewed':
      return !!card && card.fsrs.reps > 0;
    case 'skipped':
      return skipped;
    default:
      return true;
  }
}

function matchesSearch({ frontendId, metadata }: RoadmapProblem, query: string, domain: LeetcodeDomain): boolean {
  if (!query || frontendId.includes(query)) {
    return true;
  }
  if (!metadata) {
    return false;
  }
  return (
    metadata.title.toLowerCase().includes(query) || getProblemTitle(metadata, domain).toLowerCase().includes(query)
  );
}

interface RoadmapProblemListProps {
  roadmap: RoadmapSummary;
  search: string;
  filter: RoadmapFilter | null;
}

export function RoadmapProblemList({ roadmap, search, filter }: RoadmapProblemListProps) {
  const t = useI18n();
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const { data: settings } = useSettingsQuery();
  const domain = settings.preferredLeetcodeSite;
  const metadata = useQuery(roadmapMetadataQueryOptions(roadmap, domain));
  const skips = useQuery(roadmapSkipsQueryOptions);
  const skip = useSkipRoadmapProblemMutation();
  const add = useAddCardMutation();

  if (metadata.isPending || skips.isPending) {
    return (
      <p role="status" className="text-secondary">
        {t.roadmaps.loading}
      </p>
    );
  }
  if (metadata.isError || skips.isError) {
    return (
      <div role="alert">
        <p>{t.roadmaps.detailLoadFailed}</p>
        <button
          type="button"
          className="text-accent cursor-pointer"
          onClick={() => {
            void metadata.refetch();
            void skips.refetch();
          }}
        >
          {t.roadmaps.retry}
        </button>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const filtering = query !== '' || filter !== null;
  const skippedIds = new Set(skips.data[roadmap.id]);
  const groups = roadmap.groups.map((group) => ({
    ...group,
    reviewed: group.frontendIds.filter((id) => document.cards[id]?.fsrs.reps > 0).length,
    problems: group.frontendIds
      .map(
        (frontendId): RoadmapProblem => ({
          frontendId,
          metadata: metadata.data[frontendId],
          card: document.cards[frontendId],
          skipped: skippedIds.has(frontendId),
        })
      )
      .filter((problem) => matchesSearch(problem, query, domain) && matchesFilter(problem, filter)),
  }));

  return (
    <>
      {add.isError && (
        <p role="alert" className="text-danger">
          {t.roadmaps.addFailed}
        </p>
      )}
      {skip.isError && (
        <p role="alert" className="text-danger">
          {t.roadmaps.skipFailed}
        </p>
      )}
      {groups.every((group) => group.problems.length === 0) && <p className="text-secondary">{t.roadmaps.noMatches}</p>}
      <div>
        {groups.map((group) => (
          <RoadmapGroup
            key={group.id}
            name={group.name}
            reviewed={group.reviewed}
            total={group.frontendIds.length}
            filtering={filtering}
            hasMatches={group.problems.length > 0}
          >
            {group.problems.map((problem) => (
              <RoadmapProblemRow
                key={problem.frontendId}
                problem={problem}
                domain={domain}
                isSaving={skip.isPending}
                isAdding={add.isPending}
                onAdd={() => add.mutate({ frontendId: problem.frontendId, domain })}
                onToggleSkip={() =>
                  skip.mutate({ roadmapId: roadmap.id, frontendId: problem.frontendId, skipped: !problem.skipped })
                }
              />
            ))}
          </RoadmapGroup>
        ))}
      </div>
    </>
  );
}
