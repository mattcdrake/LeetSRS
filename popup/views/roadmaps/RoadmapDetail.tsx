import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { LuArrowUpRight } from 'react-icons/lu';
import { useProblemSaveFeedback } from '@/popup/components/problem-save/SaveProblemButton';
import { RoadmapProgress } from '@/popup/components/RoadmapProgress';
import { useI18n } from '@/popup/contexts/I18nContext';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import { useSkipRoadmapProblemMutation } from '@/popup/queries/roadmaps';
import { buttonInteraction } from '@/popup/styles';
import { roadmapProblemIds } from '@/shared/roadmap';
import type { RoadmapSummary } from './RoadmapOverview';
import { matchesFilter, ROADMAP_FILTERS, type RoadmapFilter, RoadmapProblemList } from './RoadmapProblemList';
import { RoadmapToolbar } from './RoadmapToolbar';

export function RoadmapDetail({ roadmap, isActive }: { roadmap: RoadmapSummary; isActive: boolean }) {
  const t = useI18n();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RoadmapFilter | null>(null);
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const skip = useSkipRoadmapProblemMutation();
  const { message, onSaved } = useProblemSaveFeedback();

  const skippedIds = new Set(document.roadmapSkips[roadmap.id]);
  const problems = roadmapProblemIds(roadmap).map((id) => ({ card: document.cards[id], skipped: skippedIds.has(id) }));
  const counts = Object.fromEntries(
    ROADMAP_FILTERS.map((id) => [id, problems.filter((problem) => matchesFilter(problem, id)).length])
  ) as Record<RoadmapFilter, number>;

  return (
    <>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-baseline gap-1.5">
          {t.roadmaps.summaryPrefix && <span className="text-[13px] text-secondary">{t.roadmaps.summaryPrefix}</span>}
          <span className="text-[17px] font-semibold tracking-[-0.01em] tabular-nums">{roadmap.reviewed}</span>
          <span className="text-[13px] text-secondary tabular-nums">{t.roadmaps.summarySuffix(roadmap.total)}</span>
          <a
            href={roadmap.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`ml-auto inline-flex items-center gap-1 rounded-sm text-xs text-tertiary hover:text-primary ${buttonInteraction}`}
          >
            {roadmap.id === 'grind-75' ? 'Grind 75' : 'NeetCode'}
            <LuArrowUpRight aria-hidden="true" className="size-3" strokeWidth={2} />
          </a>
        </div>
        <RoadmapProgress label={roadmap.name} summary={roadmap} size="md" className="mt-2.5" />
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-secondary tabular-nums">
          <LegendItem className="bg-accent">{t.roadmaps.legend.reviewed(roadmap.reviewed)}</LegendItem>
          <LegendItem className="bg-accent opacity-40">{t.roadmaps.legend.new(roadmap.new)}</LegendItem>
          <LegendItem className="bg-[var(--current-skipped)]">{t.roadmaps.legend.skipped(roadmap.skipped)}</LegendItem>
        </ul>
      </div>
      <RoadmapToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        total={problems.length}
        counts={counts}
      >
        <p role="status" className="mt-2 text-xs text-accent empty:hidden">
          {message}
        </p>
        {skip.isError && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {t.roadmaps.skipFailed}
          </p>
        )}
      </RoadmapToolbar>
      <RoadmapProblemList
        roadmap={roadmap}
        search={search}
        filter={filter}
        isActive={isActive}
        skip={skip}
        onSaved={onSaved}
        onClearFilters={() => {
          setSearch('');
          setFilter(null);
        }}
      />
    </>
  );
}

function LegendItem({ className, children }: { className: string; children: string }) {
  return (
    <li className="flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${className}`} />
      {children}
    </li>
  );
}
