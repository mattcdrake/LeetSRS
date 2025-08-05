import { useTodayStatsQuery } from '@/hooks/useBackgroundQueries';
import { FaFireFlameCurved } from 'react-icons/fa6';

export function StreakCounter() {
  const { data: todayStats } = useTodayStatsQuery();
  const streak = todayStats?.streak ?? 0;

  if (streak === 0) return null;

  return (
    <div className="flex items-center gap-1 text-sm font-medium text-primary">
      <FaFireFlameCurved className="text-orange-500" />
      <span>{streak}</span>
    </div>
  );
}
