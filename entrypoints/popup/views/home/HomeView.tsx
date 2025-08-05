import { ViewLayout } from '../../components/ViewLayout';
import { StatsBar } from './StatsBar';
import { ReviewQueue } from './ReviewQueue';
import { StreakCounter } from '../../components/StreakCounter';

export function HomeView() {
  return (
    <ViewLayout
      headerContent={
        <div className="flex items-center justify-end gap-4 w-full">
          <StatsBar />
          <StreakCounter />
        </div>
      }
    >
      <ReviewQueue />
    </ViewLayout>
  );
}
