import { FaFireFlameCurved } from 'react-icons/fa6';
import { useTodayReviewActivityQuery } from '@/popup/queries/review-activity';

export function StreakCounter() {
  const { data: activity } = useTodayReviewActivityQuery();
  const streak = activity?.streak ?? 0;

  if (streak === 0) return null;

  return (
    <div className="flex items-center gap-1 text-sm font-medium text-primary">
      <FaFireFlameCurved className="text-orange-500" />
      <span>{streak}</span>
    </div>
  );
}
