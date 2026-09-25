import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useId, useLayoutEffect, useRef } from 'react';
import { LuChevronRight } from 'react-icons/lu';
import { Difficulty } from '@/popup/components/Difficulty';
import { RoadmapProgress } from '@/popup/components/RoadmapProgress';
import { useI18n } from '@/popup/contexts/I18nContext';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import { roadmapMetadataQueryOptions } from '@/popup/queries/roadmaps';
import { useSettingsQuery } from '@/popup/queries/settings';
import { buttonInteraction, compactOutlineButton } from '@/popup/styles';
import { getNextRoadmapProblemId, type Roadmap, type RoadmapId, type RoadmapProgressSummary } from '@/shared/roadmap';
import { getProblemTitle } from '@/shared/ui/problem-title';

export type RoadmapSummary = Roadmap & RoadmapProgressSummary;

interface RoadmapOverviewProps {
  roadmaps: RoadmapSummary[];
  activeRoadmapId: RoadmapId | null;
  isSaving: boolean;
  onActivate: (id: RoadmapId) => void;
  onOpen: (id: RoadmapId) => void;
}

export function RoadmapOverview({ roadmaps, activeRoadmapId, isSaving, onActivate, onOpen }: RoadmapOverviewProps) {
  const t = useI18n();
  const currentId = useId();
  const othersId = useId();
  const rows = useRef(new Map<RoadmapId, HTMLElement>());
  const previousPositions = useRef(new Map<RoadmapId, number>());

  // FLIP animates each roadmap from its previous position, including between the two sections.
  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const positions = new Map<RoadmapId, number>();
    for (const [id, row] of rows.current) {
      const top = row.getBoundingClientRect().top;
      positions.set(id, top);
      const previous = previousPositions.current.get(id);
      if (previous !== undefined && previous !== top && !reduceMotion) {
        row.animate([{ transform: `translateY(${previous - top}px)` }, { transform: 'translateY(0)' }], {
          duration: 480,
          delay: 70,
          easing: 'cubic-bezier(.22, 1, .36, 1)',
          fill: 'backwards',
        });
      }
    }
    previousPositions.current = positions;
  });

  const trackRow = (id: RoadmapId) => (row: HTMLElement | null) => {
    if (row) rows.current.set(id, row);
    else rows.current.delete(id);
  };
  const active = roadmaps.find((roadmap) => roadmap.id === activeRoadmapId);
  const others = roadmaps.filter((roadmap) => roadmap !== active);

  return (
    <div className="flex flex-col gap-5">
      {active && (
        <section aria-labelledby={currentId}>
          <h2 id={currentId} className="mb-1.5 text-xs text-tertiary">
            {t.home.currentRoadmap}
          </h2>
          <div
            ref={trackRow(active.id)}
            className="relative z-[1] rounded-xl border border-current bg-surface shadow-card"
          >
            <div className="px-3.5 py-3">
              <RoadmapItem roadmap={active} onOpen={() => onOpen(active.id)} />
            </div>
            <NextProblem roadmap={active} />
          </div>
        </section>
      )}
      <section aria-labelledby={othersId}>
        <h2 id={othersId} className="mb-0.5 text-xs text-tertiary">
          {active ? t.roadmaps.otherRoadmaps : t.home.chooseRoadmap}
        </h2>
        <ul>
          {others.map((roadmap) => (
            <li
              key={roadmap.id}
              ref={trackRow(roadmap.id)}
              className="flex items-center gap-3 py-3 border-t border-current first:border-t-0"
            >
              <RoadmapItem roadmap={roadmap} onOpen={() => onOpen(roadmap.id)} />
              <button
                type="button"
                className={compactOutlineButton}
                aria-label={t.roadmaps.activationLabel(roadmap.name)}
                disabled={isSaving}
                onClick={() => onActivate(roadmap.id)}
              >
                {t.roadmaps.use}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RoadmapItem({ roadmap, onOpen }: { roadmap: RoadmapSummary; onOpen: () => void }) {
  const t = useI18n();
  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        className={`group w-full flex items-center gap-2 rounded-md text-left ${buttonInteraction}`}
        aria-label={t.roadmaps.open(roadmap.name)}
        onClick={onOpen}
      >
        <span className="min-w-0 truncate text-[13px] font-medium transition-colors duration-[120ms] group-hover:text-accent">
          {roadmap.name}
        </span>
        <span aria-hidden="true" className="ml-auto shrink-0 text-xs text-tertiary tabular-nums">
          {roadmap.reviewed} / {roadmap.total}
        </span>
        <LuChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-tertiary" strokeWidth={2} />
      </button>
      <RoadmapProgress label={roadmap.name} summary={roadmap} className="mt-2 mr-[22px]" />
    </div>
  );
}

function NextProblem({ roadmap }: { roadmap: Roadmap }) {
  const t = useI18n();
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const { data: settings } = useSettingsQuery();
  const domain = settings.preferredLeetcodeSite;
  const metadata = useQuery(roadmapMetadataQueryOptions(roadmap, domain));
  const nextId = getNextRoadmapProblemId(roadmap, document, metadata.data, domain);
  const next = nextId ? metadata.data?.[nextId] : undefined;
  if (!next) return null;

  return (
    <p className="flex items-center gap-2 border-t border-current px-3.5 py-2.5 text-xs">
      <span className="shrink-0 text-tertiary">{t.roadmaps.next}</span>
      <span className="min-w-0 truncate">
        <span className="text-tertiary tabular-nums">{next.frontendId}.</span> {getProblemTitle(next, domain)}
      </span>
      <span className="ml-auto shrink-0">
        <Difficulty difficulty={next.difficulty} />
      </span>
    </p>
  );
}
