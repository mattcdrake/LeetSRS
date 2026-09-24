import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { FaArrowLeft } from 'react-icons/fa6';
import { QueryState } from '@/popup/components/QueryState';
import { ViewLayout } from '@/popup/components/ViewLayout';
import { useI18n } from '@/popup/contexts/I18nContext';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import { activeRoadmapQueryOptions, roadmapsQueryOptions, useActivateRoadmapMutation } from '@/popup/queries/roadmaps';
import { countReviewed, type RoadmapId, roadmapProblemIds } from '@/shared/roadmap';
import { RoadmapDetail } from './RoadmapDetail';
import { RoadmapOverview } from './RoadmapOverview';

interface RoadmapsViewProps {
  selectedRoadmapId: RoadmapId | null;
  onSelect: (id: RoadmapId | null) => void;
}

export function RoadmapsView({ selectedRoadmapId, onSelect }: RoadmapsViewProps) {
  const t = useI18n();
  const roadmaps = useQuery(roadmapsQueryOptions);
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const { data: activeRoadmapId } = useSuspenseQuery(activeRoadmapQueryOptions);
  const activation = useActivateRoadmapMutation();
  const summaries = (roadmaps.data ?? []).map((roadmap) => {
    const ids = roadmapProblemIds(roadmap);
    return { ...roadmap, total: ids.length, reviewed: countReviewed(document, ids) };
  });
  const selected = summaries.find((roadmap) => roadmap.id === selectedRoadmapId);

  return (
    <ViewLayout
      title={selected?.name ?? t.nav.roadmaps}
      headerContent={
        (selected || activeRoadmapId) && (
          <button
            type="button"
            className="roadmap-text-button"
            disabled={activation.isPending}
            onClick={() => activation.mutate(selected && selected.id !== activeRoadmapId ? selected.id : null)}
          >
            {selected && selected.id !== activeRoadmapId ? t.roadmaps.activate : t.roadmaps.deactivate}
          </button>
        )
      }
      headerLeading={
        selected && (
          <button
            type="button"
            aria-label={t.roadmaps.back}
            onClick={() => onSelect(null)}
            className="p-1 -ml-1 cursor-pointer text-secondary hover:text-primary focus-visible:outline-2"
          >
            <FaArrowLeft aria-hidden="true" />
          </button>
        )
      }
    >
      {activation.isError && (
        <p role="alert" className="text-danger mb-3">
          {t.roadmaps.saveFailed}
        </p>
      )}
      <QueryState query={roadmaps} loading={t.roadmaps.loading} error={t.roadmaps.loadFailed}>
        {selected ? (
          <RoadmapDetail key={selected.id} roadmap={selected} />
        ) : (
          <RoadmapOverview
            roadmaps={summaries}
            activeRoadmapId={activeRoadmapId}
            isSaving={activation.isPending}
            onActivate={(id) => activation.mutate(id)}
            onOpen={onSelect}
          />
        )}
      </QueryState>
    </ViewLayout>
  );
}
