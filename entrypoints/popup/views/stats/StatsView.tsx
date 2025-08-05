import { ViewLayout } from '../../components/ViewLayout';
import { StreakCounter } from '../../components/StreakCounter';
import { CardDistributionChart } from './CardDistributionChart';
import { ReviewHistoryChart } from './ReviewHistoryChart';
import { UpcomingReviewsChart } from './UpcomingReviewsChart';

export function StatsView() {
  return (
    <ViewLayout title="Statistics" headerContent={<StreakCounter />}>
      <CardDistributionChart />
      <ReviewHistoryChart />
      <UpcomingReviewsChart />
    </ViewLayout>
  );
}
