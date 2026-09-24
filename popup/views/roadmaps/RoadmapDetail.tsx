import { useState } from 'react';
import { FaArrowUpRightFromSquare } from 'react-icons/fa6';
import { SearchFilterBar } from '@/popup/components/SearchFilterBar';
import { useI18n } from '@/popup/contexts/I18nContext';
import type { RoadmapSummary } from './RoadmapOverview';
import { ROADMAP_FILTERS, type RoadmapFilter, RoadmapProblemList } from './RoadmapProblemList';

export function RoadmapDetail({ roadmap }: { roadmap: RoadmapSummary }) {
  const t = useI18n();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RoadmapFilter | null>(null);

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
        filters={ROADMAP_FILTERS.map((id) => ({
          id,
          label: t.roadmaps.filters[id],
          isSelected: filter === id,
          onChange: (selected) => setFilter(selected ? id : null),
        }))}
      />
      <RoadmapProblemList roadmap={roadmap} search={search} filter={filter} />
    </div>
  );
}
