import { type ReactNode, useId, useState } from 'react';
import { LuChevronRight } from 'react-icons/lu';
import { useI18n } from '@/popup/contexts/I18nContext';

interface RoadmapGroupProps {
  name: string;
  reviewed: number;
  total: number;
  filtering: boolean;
  hasMatches: boolean;
  defaultExpanded: boolean;
  children: ReactNode;
}

export function RoadmapGroup({
  name,
  reviewed,
  total,
  filtering,
  hasMatches,
  defaultExpanded,
  children,
}: RoadmapGroupProps) {
  const t = useI18n();
  const contentId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const open = filtering || expanded;

  // Keep manual expansion state when search temporarily hides this group.
  if (!hasMatches) {
    return null;
  }

  return (
    <section className="border-t border-current first:border-t-0">
      {/* Sticks just below the 48px toolbar. */}
      <h2 className="sticky top-12 z-10 bg-primary">
        <button
          type="button"
          className="w-full h-10 flex items-center gap-2 px-4 text-left cursor-pointer transition-colors duration-[120ms] hover:bg-[color-mix(in_srgb,var(--current-bg-secondary)_50%,var(--current-bg-primary))] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--current-accent)]"
          aria-expanded={open}
          aria-controls={contentId}
          aria-disabled={filtering || undefined}
          onClick={() => {
            if (!filtering) {
              setExpanded((current) => !current);
            }
          }}
        >
          <LuChevronRight
            aria-hidden="true"
            className={`size-3.5 shrink-0 text-tertiary transition-transform duration-[120ms] ${open ? 'rotate-90' : ''}`}
            strokeWidth={2}
          />
          <span className="min-w-0 truncate text-[13px] font-medium">{name}</span>
          <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-tertiary tabular-nums">
            <span className="sr-only">{t.roadmaps.reviewed(reviewed, total)}</span>
            <span aria-hidden="true">
              {reviewed} / {total}
            </span>
            <ProgressRing value={reviewed} total={total} />
          </span>
        </button>
      </h2>
      <ul id={contentId} hidden={!open} className="px-4 pb-2">
        {open && children}
      </ul>
    </section>
  );
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 5.5;

function ProgressRing({ value, total }: { value: number; total: number }) {
  return (
    <svg aria-hidden="true" className="size-3.5 shrink-0 -rotate-90" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--current-border-strong)" strokeWidth="2" />
      {value > 0 && (
        <circle
          cx="7"
          cy="7"
          r="5.5"
          fill="none"
          stroke="var(--current-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${(RING_CIRCUMFERENCE * value) / total} ${RING_CIRCUMFERENCE}`}
        />
      )}
    </svg>
  );
}
