import { ProgressBar } from 'react-aria-components';
import { useI18n } from '@/popup/contexts/I18nContext';
import type { RoadmapProgressSummary } from '@/shared/roadmap';

interface RoadmapProgressProps {
  label: string;
  summary: RoadmapProgressSummary;
  size?: 'sm' | 'md';
  className?: string;
}

// Reviewed problems are the bar's value; saved and skipped problems are decorative segments beside them.
export function RoadmapProgress({ label, summary, size = 'sm', className = '' }: RoadmapProgressProps) {
  const t = useI18n();
  const width = (count: number) => `${(count / summary.total) * 100}%`;
  return (
    <ProgressBar
      aria-label={label}
      value={summary.reviewed}
      maxValue={summary.total}
      valueLabel={t.roadmaps.reviewed(summary.reviewed, summary.total)}
      className={`flex overflow-hidden rounded-full bg-secondary ${size === 'md' ? 'h-1.5' : 'h-1'} ${className}`}
    >
      <div className="bg-accent" style={{ width: width(summary.reviewed) }} />
      <div className="bg-accent opacity-35" style={{ width: width(summary.new) }} />
      <div className="bg-[var(--current-skipped)]" style={{ width: width(summary.skipped) }} />
    </ProgressBar>
  );
}
