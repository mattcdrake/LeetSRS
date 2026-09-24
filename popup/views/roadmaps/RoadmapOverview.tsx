import { useLayoutEffect, useRef } from 'react';
import { FaChevronRight } from 'react-icons/fa6';
import { LuCheck } from 'react-icons/lu';
import { useI18n } from '@/popup/contexts/I18nContext';
import type { Roadmap, RoadmapId } from '@/shared/roadmap';
import './roadmaps.css';

export type RoadmapSummary = Roadmap & { reviewed: number; total: number };

interface RoadmapOverviewProps {
  roadmaps: RoadmapSummary[];
  activeRoadmapId: RoadmapId | null;
  isSaving: boolean;
  onActivate: (id: RoadmapId) => void;
  onOpen: (id: RoadmapId) => void;
}

export function RoadmapOverview({ roadmaps, activeRoadmapId, isSaving, onActivate, onOpen }: RoadmapOverviewProps) {
  const t = useI18n();
  const rows = useRef(new Map<RoadmapId, HTMLElement>());
  const previousPositions = useRef(new Map<RoadmapId, number>());

  // FLIP keeps each row's DOM identity while animating its new position.
  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const positions = new Map<RoadmapId, number>();
    for (const [id, row] of rows.current) {
      const top = row.offsetTop;
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

  const ordered = [...roadmaps].sort((a, b) => Number(b.id === activeRoadmapId) - Number(a.id === activeRoadmapId));

  return (
    <div className="roadmap-overview">
      {ordered.map((roadmap) => {
        const active = roadmap.id === activeRoadmapId;
        return (
          <section
            key={roadmap.id}
            ref={(row) => {
              if (row) rows.current.set(roadmap.id, row);
              else rows.current.delete(roadmap.id);
            }}
            className={`roadmap-row ${active ? 'is-active' : ''}`}
            aria-label={roadmap.name}
          >
            <button
              type="button"
              className="roadmap-open"
              aria-label={t.roadmaps.open(roadmap.name)}
              aria-describedby={`roadmap-progress-${roadmap.id}`}
              onClick={() => onOpen(roadmap.id)}
            >
              <span className="roadmap-name">{roadmap.name}</span>
              <span className="roadmap-count text-secondary">
                <span id={`roadmap-progress-${roadmap.id}`} className="sr-only">
                  {t.roadmaps.reviewed(roadmap.reviewed, roadmap.total)}
                </span>
                <span aria-hidden="true">
                  {roadmap.reviewed} / {roadmap.total}
                </span>
                <FaChevronRight aria-hidden="true" className="text-xs" />
              </span>
            </button>
            {active ? (
              <span className="roadmap-active-label">
                <LuCheck aria-hidden="true" className="size-3" />
                {t.roadmaps.active}
              </span>
            ) : (
              <button
                type="button"
                className="roadmap-activation"
                aria-label={t.roadmaps.activationLabel(roadmap.name)}
                disabled={isSaving}
                onClick={() => onActivate(roadmap.id)}
              >
                {t.roadmaps.use}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
