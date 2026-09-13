import { LeetcodeCnBanner } from '../../components/LeetcodeCnBanner';
import { StreakCounter } from '../../components/StreakCounter';
import { ViewLayout } from '../../components/ViewLayout';
import { ReviewQueue } from './ReviewQueue';
import { StatsBar } from './StatsBar';

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
      <LeetcodeCnBanner />
      <ReviewQueue />
    </ViewLayout>
  );
}
