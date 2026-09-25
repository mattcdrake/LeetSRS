import { LuFlame } from 'react-icons/lu';
import { useTodayReviewActivityQuery } from '@/popup/queries/review-activity';

export function StreakCounter() {
  const { data: activity } = useTodayReviewActivityQuery();
  const streak = activity?.streak ?? 0;

  if (streak === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs font-semibold text-primary tabular-nums">
      <LuFlame aria-hidden="true" className="size-3.5 text-warning" strokeWidth={2} />
      <span>{streak}</span>
    </div>
  );
}
