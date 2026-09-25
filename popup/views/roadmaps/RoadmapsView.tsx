import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { LuArrowLeft, LuCheck, LuChevronDown } from 'react-icons/lu';
import { QueryState } from '@/popup/components/QueryState';
import { ViewLayout } from '@/popup/components/ViewLayout';
import { useI18n } from '@/popup/contexts/I18nContext';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import { roadmapsQueryOptions, useActivateRoadmapMutation } from '@/popup/queries/roadmaps';
import { buttonInteraction, compactOutlineButton, menuItem, menuPopover } from '@/popup/styles';
import { type RoadmapId, roadmapProblemIds, summarizeRoadmap } from '@/shared/roadmap';
import { RoadmapDetail } from './RoadmapDetail';
import { RoadmapOverview } from './RoadmapOverview';
import { RoadmapSkeleton } from './RoadmapProblemList';

interface RoadmapsViewProps {
  selectedRoadmapId: RoadmapId | null;
  onSelect: (id: RoadmapId | null) => void;
}

export function RoadmapsView({ selectedRoadmapId, onSelect }: RoadmapsViewProps) {
  const t = useI18n();
  const roadmaps = useQuery(roadmapsQueryOptions);
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const activeRoadmapId = document.activeRoadmapId;
  const activation = useActivateRoadmapMutation();
  const summaries = (roadmaps.data ?? []).map((roadmap) => ({
    ...roadmap,
    ...summarizeRoadmap(document, roadmapProblemIds(roadmap), document.roadmapSkips[roadmap.id]),
  }));
  const selected = summaries.find((roadmap) => roadmap.id === selectedRoadmapId);
  const isSelectedActive = selected?.id === activeRoadmapId;

  return (
    <ViewLayout
      title={selected?.name ?? t.nav.roadmaps}
      flush={!!selected}
      headerContent={
        selected &&
        (isSelectedActive ? (
          <MenuTrigger>
            <Button
              className={`h-7 pl-2 pr-1.5 rounded-md flex items-center gap-1 bg-accent-soft text-accent text-xs font-medium duration-[120ms] hover:bg-[color-mix(in_srgb,var(--current-accent)_18%,var(--current-bg-primary))] ${buttonInteraction}`}
              isDisabled={activation.isPending}
            >
              <LuCheck aria-hidden="true" className="size-3" strokeWidth={2.4} />
              {t.roadmaps.active}
              <LuChevronDown aria-hidden="true" className="size-3" strokeWidth={2} />
            </Button>
            <Popover placement="bottom end" offset={4} className={menuPopover}>
              <Menu className="outline-none" onAction={() => activation.mutate(null)}>
                <MenuItem id="stop" className={menuItem}>
                  {t.roadmaps.stopUsing}
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        ) : (
          <button
            type="button"
            className={compactOutlineButton}
            aria-label={t.roadmaps.activationLabel(selected.name)}
            disabled={activation.isPending}
            onClick={() => activation.mutate(selected.id)}
          >
            {t.roadmaps.use}
          </button>
        ))
      }
      headerLeading={
        selected && (
          <button
            type="button"
            aria-label={t.roadmaps.back}
            onClick={() => onSelect(null)}
            className={`size-7 -ml-1.5 rounded-md grid place-items-center text-secondary duration-[120ms] hover:bg-secondary hover:text-primary ${buttonInteraction}`}
          >
            <LuArrowLeft aria-hidden="true" className="size-4" />
          </button>
        )
      }
    >
      {activation.isError && (
        <p role="alert" className={`text-xs text-danger ${selected ? 'px-4 pt-3' : 'mb-3'}`}>
          {t.roadmaps.saveFailed}
        </p>
      )}
      <QueryState query={roadmaps} loading={<RoadmapSkeleton />} error={t.roadmaps.loadFailed}>
        {selected ? (
          <RoadmapDetail key={selected.id} roadmap={selected} isActive={isSelectedActive} />
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
