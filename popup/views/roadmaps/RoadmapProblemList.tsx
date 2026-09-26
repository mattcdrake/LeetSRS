import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { LuSearch } from 'react-icons/lu';
import { type SavedProblem, SaveProblemSheet, useSaveProblem } from '@/popup/components/problem-save/SaveProblemButton';
import { QueryState } from '@/popup/components/QueryState';
import { useI18n } from '@/popup/contexts/I18nContext';
import { usePopupClock } from '@/popup/hooks/usePopupClock';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import { roadmapMetadataQueryOptions, type useSkipRoadmapProblemMutation } from '@/popup/queries/roadmaps';
import { useSettingsQuery } from '@/popup/queries/settings';
import { buttonInteraction } from '@/popup/styles';
import type { ProblemReference } from '@/shared/learning-document';
import type { LeetcodeDomain } from '@/shared/leetcode-domain';
import { getNextRoadmapProblemId, isReviewed } from '@/shared/roadmap';
import { getProblemTitle } from '@/shared/ui/problem-title';
import { RoadmapGroup } from './RoadmapGroup';
import type { RoadmapSummary } from './RoadmapOverview';
import { type RoadmapProblem, RoadmapProblemRow } from './RoadmapProblemRow';

export const ROADMAP_FILTERS = ['notInSrs', 'inSrs', 'reviewed', 'skipped'] as const;
export type RoadmapFilter = (typeof ROADMAP_FILTERS)[number];

export function matchesFilter(
  { card, skipped }: Pick<RoadmapProblem, 'card' | 'skipped'>,
  filter: RoadmapFilter | null
): boolean {
  switch (filter) {
    case 'notInSrs':
      return !card;
    case 'inSrs':
      return !!card;
    case 'reviewed':
      return isReviewed(card);
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
  isActive: boolean;
  skip: ReturnType<typeof useSkipRoadmapProblemMutation>;
  isAdding: boolean;
  onAdd: (problem: ProblemReference & { title: string }) => void;
  onSaved: (saved: SavedProblem) => void;
  onClearFilters: () => void;
}

export function RoadmapProblemList({
  roadmap,
  search,
  filter,
  isActive,
  skip,
  isAdding,
  onAdd,
  onSaved,
  onClearFilters,
}: RoadmapProblemListProps) {
  const t = useI18n();
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const { data: settings } = useSettingsQuery();
  const domain = settings.preferredLeetcodeSite;
  const metadata = useQuery(roadmapMetadataQueryOptions(roadmap, domain));
  const now = usePopupClock();
  const rating = useSaveProblem(onSaved);

  if (!metadata.isSuccess) {
    return (
      <QueryState
        query={metadata}
        loading={<RoadmapSkeleton />}
        error={t.roadmaps.detailLoadFailed}
        className="block px-4 py-2"
      />
    );
  }

  const query = search.trim().toLowerCase();
  const filtering = query !== '' || filter !== null;
  const skippedIds = new Set(document.roadmapSkips[roadmap.id]);
  const nextId = isActive ? getNextRoadmapProblemId(roadmap, document, metadata.data, domain) : undefined;
  const groups = roadmap.groups.map((group) => ({
    ...group,
    reviewed: group.frontendIds.filter((id) => isReviewed(document.cards[id])).length,
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

  // Groups stay mounted while nothing matches so they keep their expansion state.
  return (
    <div className="pb-4">
      {groups.every((group) => group.problems.length === 0) && (
        <div className="px-6 pt-10 pb-2 text-center">
          <div className="mx-auto size-9 rounded-full bg-secondary grid place-items-center text-tertiary">
            <LuSearch aria-hidden="true" className="size-4" strokeWidth={2} />
          </div>
          <p className="mt-3 text-[13px] font-medium">{t.roadmaps.noMatches}</p>
          <p className="mt-1 text-xs text-tertiary">{t.roadmaps.noMatchesHint}</p>
          <button
            type="button"
            className={`mt-4 h-8 px-3 rounded-lg border border-strong text-xs text-secondary duration-[120ms] hover:bg-secondary ${buttonInteraction}`}
            onClick={onClearFilters}
          >
            {t.roadmaps.clearFilters}
          </button>
        </div>
      )}
      {groups.map((group) => (
        <RoadmapGroup
          key={group.id}
          name={group.name}
          reviewed={group.reviewed}
          total={group.frontendIds.length}
          filtering={filtering}
          hasMatches={group.problems.length > 0}
          defaultExpanded={nextId !== undefined && group.frontendIds.includes(nextId)}
        >
          {group.problems.map((problem) => (
            <RoadmapProblemRow
              key={problem.frontendId}
              problem={problem}
              domain={domain}
              now={now}
              isNext={problem.frontendId === nextId}
              isSkipping={skip.isPending}
              isAdding={isAdding}
              onAdd={onAdd}
              onToggleSkip={() =>
                skip.mutate({ roadmapId: roadmap.id, frontendId: problem.frontendId, skipped: !problem.skipped })
              }
              onRate={rating.open}
            />
          ))}
        </RoadmapGroup>
      ))}
      <SaveProblemSheet save={rating} />
    </div>
  );
}

// Rendered inside QueryState's status paragraph, so it uses phrasing elements only.
export function RoadmapSkeleton() {
  const t = useI18n();
  return (
    <>
      <span className="sr-only">{t.roadmaps.loading}</span>
      {[72, 58, 66, 50].map((width) => (
        <span key={width} aria-hidden="true" className="flex items-center gap-2.5 py-2.5">
          <span className="size-4 shrink-0 rounded-full bg-secondary" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-2.5 rounded bg-secondary" style={{ width: `${width}%` }} />
            <span className="h-2 w-14 rounded bg-secondary" />
          </span>
        </span>
      ))}
    </>
  );
}
