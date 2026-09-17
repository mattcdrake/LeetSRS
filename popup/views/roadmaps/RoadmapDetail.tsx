import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FaArrowUpRightFromSquare, FaChevronRight, FaLock } from 'react-icons/fa6';
import { SearchFilterBar } from '@/popup/components/SearchFilterBar';
import { useI18n } from '@/popup/contexts/I18nContext';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import {
  roadmapMetadataQueryOptions,
  roadmapSkipsQueryOptions,
  useSkipRoadmapProblemMutation,
} from '@/popup/queries/roadmaps';
import { useSettingsQuery } from '@/popup/queries/settings';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import { DIFFICULTY_COLORS } from '@/shared/ui/difficulty-colors';
import { getProblemTitle } from '@/shared/ui/problem-title';
import type { RoadmapSummary } from './RoadmapOverview';

const FILTERS = ['notInSrs', 'inSrs', 'reviewed', 'skipped'] as const;
type RoadmapFilter = (typeof FILTERS)[number];

export function RoadmapDetail({ roadmap }: { roadmap: RoadmapSummary }) {
  const t = useI18n();
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const { data: settings } = useSettingsQuery();
  const metadata = useQuery(roadmapMetadataQueryOptions(roadmap));
  const skips = useQuery(roadmapSkipsQueryOptions);
  const skip = useSkipRoadmapProblemMutation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RoadmapFilter | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const domain = settings.preferredLeetcodeSite;
  const skippedIds = new Set(skips.data?.[roadmap.id]);
  const query = search.trim().toLowerCase();
  const filtering = query !== '' || filter !== null;
  const reviewed = (id: string) => document.cards[id]?.fsrs.reps > 0;
  const groups = roadmap.groups
    .map((group) => ({
      ...group,
      visibleIds: group.frontendIds.filter((id) => {
        const problem = metadata.data?.[id];
        const matchesSearch =
          !query ||
          id.includes(query) ||
          problem?.title.toLowerCase().includes(query) ||
          (problem && getProblemTitle(problem, domain).toLowerCase().includes(query));
        const matchesFilter =
          filter === null ||
          (filter === 'notInSrs' && !document.cards[id]) ||
          (filter === 'inSrs' && !!document.cards[id]) ||
          (filter === 'reviewed' && reviewed(id)) ||
          (filter === 'skipped' && skippedIds.has(id));
        return matchesSearch && matchesFilter;
      }),
    }))
    .filter((group) => group.visibleIds.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span>{t.roadmaps.reviewed(roadmap.reviewed, roadmap.total)}</span>
        <a
          href={roadmap.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-secondary hover:text-primary"
        >
          {roadmap.id === 'grind-75' ? 'Grind 75' : 'NeetCode'}
          <FaArrowUpRightFromSquare aria-hidden="true" />
        </a>
      </div>
      <progress
        className="roadmap-progress"
        value={roadmap.reviewed}
        max={roadmap.total}
        aria-label={t.roadmaps.reviewed(roadmap.reviewed, roadmap.total)}
      />
      <SearchFilterBar
        searchText={search}
        onSearchTextChange={setSearch}
        searchLabel={t.roadmaps.searchLabel}
        searchPlaceholder={t.cardsView.filterPlaceholder}
        clearSearchLabel={t.cardsView.clearFilterAriaLabel}
        filters={FILTERS.map((id) => ({
          id,
          label: t.roadmaps.filters[id],
          isSelected: filter === id,
          onChange: (selected) => setFilter(selected ? id : null),
        }))}
      />
      {metadata.isPending || skips.isPending ? (
        <p role="status" className="text-secondary">
          {t.roadmaps.loading}
        </p>
      ) : metadata.isError || skips.isError ? (
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
      ) : (
        <>
          {skip.isError && (
            <p role="alert" className="text-danger">
              {t.roadmaps.skipFailed}
            </p>
          )}
          <p className="text-xs text-secondary" role="status">
            {t.roadmaps.matches(
              groups.reduce((total, group) => total + group.visibleIds.length, 0),
              groups.length
            )}
          </p>
          {groups.length === 0 ? (
            <p className="text-secondary">{t.roadmaps.noMatches}</p>
          ) : (
            <div>
              {groups.map((group) => {
                const open = filtering || expanded.has(group.id);
                const groupReviewed = group.frontendIds.filter(reviewed).length;
                const contentId = `roadmap-group-${roadmap.id}-${group.id}`;
                return (
                  <section key={group.id} className="border-t border-current">
                    <h2>
                      <button
                        type="button"
                        className="roadmap-group-toggle"
                        aria-expanded={open}
                        aria-controls={contentId}
                        aria-disabled={filtering || undefined}
                        onClick={() => {
                          if (filtering) return;
                          setExpanded((current) => {
                            const next = new Set(current);
                            if (next.has(group.id)) next.delete(group.id);
                            else next.add(group.id);
                            return next;
                          });
                        }}
                      >
                        <FaChevronRight aria-hidden="true" className={open ? 'rotate-90' : ''} />
                        <span className="flex-1">{group.name}</span>
                        <span className="text-secondary font-normal tabular-nums">
                          <span className="sr-only">
                            {t.roadmaps.reviewed(groupReviewed, group.frontendIds.length)}
                          </span>
                          <span aria-hidden="true">
                            {groupReviewed} / {group.frontendIds.length}
                          </span>
                        </span>
                      </button>
                    </h2>
                    <ul id={contentId} hidden={!open}>
                      {open &&
                        group.visibleIds.map((id) => {
                          const problem = metadata.data[id];
                          const title = problem ? getProblemTitle(problem, domain) : t.roadmaps.problem(id);
                          const available = problem?.sources.includes(domain);
                          const skipped = skippedIds.has(id);
                          const state = reviewed(id) ? 'reviewed' : document.cards[id] ? 'inSrs' : 'notInSrs';
                          return (
                            <li key={id} className="roadmap-problem">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-1">
                                  {problem && available ? (
                                    <a
                                      className="text-sm hover:text-accent break-words"
                                      href={getLeetcodeProblemUrl({ domain, slug: problem.slug })}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {id}. {title}
                                    </a>
                                  ) : (
                                    <span className="text-sm break-words">{problem ? `${id}. ${title}` : title}</span>
                                  )}
                                  {problem?.isPaidOnly && (
                                    <FaLock
                                      className="shrink-0 mt-1 text-secondary text-xs"
                                      role="img"
                                      aria-label={t.roadmaps.paidOnly}
                                    />
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-1 text-xs text-secondary mt-1">
                                  {problem && (
                                    <>
                                      <span
                                        className="capitalize"
                                        style={{ color: DIFFICULTY_COLORS[problem.difficulty] }}
                                      >
                                        {problem.difficulty}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                    </>
                                  )}
                                  <span>{t.roadmaps.filters[state]}</span>
                                  {skipped && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>{t.roadmaps.filters.skipped}</span>
                                    </>
                                  )}
                                </div>
                                {!available && (
                                  <p className="text-xs text-secondary mt-1">{t.roadmaps.unavailable(domain)}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                className="roadmap-text-button"
                                disabled={skip.isPending}
                                aria-label={skipped ? t.roadmaps.restoreProblem(title) : t.roadmaps.skipProblem(title)}
                                onClick={() =>
                                  skip.mutate({ roadmapId: roadmap.id, frontendId: id, skipped: !skipped })
                                }
                              >
                                {skipped ? t.roadmaps.restore : t.roadmaps.skip}
                              </button>
                            </li>
                          );
                        })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
