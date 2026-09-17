import { type ReactNode, useId, useState } from 'react';
import { FaChevronRight } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';

interface RoadmapGroupProps {
  name: string;
  reviewed: number;
  total: number;
  filtering: boolean;
  hasMatches: boolean;
  children: ReactNode;
}

export function RoadmapGroup({ name, reviewed, total, filtering, hasMatches, children }: RoadmapGroupProps) {
  const t = useI18n();
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const open = filtering || expanded;

  // Keep manual expansion state when search temporarily hides this group.
  if (!hasMatches) {
    return null;
  }

  return (
    <section className="border-t border-current">
      <h2>
        <button
          type="button"
          className="roadmap-group-toggle"
          aria-expanded={open}
          aria-controls={contentId}
          aria-disabled={filtering || undefined}
          onClick={() => {
            if (!filtering) {
              setExpanded((current) => !current);
            }
          }}
        >
          <FaChevronRight aria-hidden="true" className={open ? 'rotate-90' : ''} />
          <span className="flex-1">{name}</span>
          <span className="text-secondary font-normal tabular-nums">
            <span className="sr-only">{t.roadmaps.reviewed(reviewed, total)}</span>
            <span aria-hidden="true">
              {reviewed} / {total}
            </span>
          </span>
        </button>
      </h2>
      <ul id={contentId} hidden={!open}>
        {open && children}
      </ul>
    </section>
  );
}
