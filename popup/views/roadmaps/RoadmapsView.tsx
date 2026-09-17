import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { FaArrowLeft } from 'react-icons/fa6';
import { ViewLayout } from '@/popup/components/ViewLayout';
import { useI18n } from '@/popup/contexts/I18nContext';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import { activeRoadmapQueryOptions, roadmapsQueryOptions, useActivateRoadmapMutation } from '@/popup/queries/roadmaps';
import type { RoadmapId } from '@/shared/roadmap';
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
    const ids = roadmap.groups.flatMap((group) => group.frontendIds);
    return {
      ...roadmap,
      total: ids.length,
      reviewed: ids.filter((id) => document.cards[id]?.fsrs.reps > 0).length,
    };
  });
  const selected = summaries.find((roadmap) => roadmap.id === selectedRoadmapId);

  return (
    <ViewLayout
      title={selected?.name ?? t.nav.roadmaps}
      headerContent={
        selected && (
          <button
            type="button"
            className="roadmap-text-button"
            disabled={activation.isPending}
            onClick={() => activation.mutate(selected.id === activeRoadmapId ? null : selected.id)}
          >
            {selected.id === activeRoadmapId ? t.roadmaps.deactivate : t.roadmaps.activate}
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
      {roadmaps.isPending ? (
        <p role="status" className="text-secondary">
          {t.roadmaps.loading}
        </p>
      ) : roadmaps.isError ? (
        <div role="alert">
          <p>{t.roadmaps.loadFailed}</p>
          <button type="button" className="text-accent cursor-pointer" onClick={() => void roadmaps.refetch()}>
            {t.roadmaps.retry}
          </button>
        </div>
      ) : selected ? (
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
    </ViewLayout>
  );
}
