import { ViewLayout } from '../../components/ViewLayout';
import { StreakCounter } from '../../components/StreakCounter';
import { CardDistributionChart } from './CardDistributionChart';
import { ReviewHistoryChart } from './ReviewHistoryChart';
import { UpcomingReviewsChart } from './UpcomingReviewsChart';
import { i18n } from '@/shared/i18n';

export function StatsView() {
  return (
    <ViewLayout title={i18n.statsView.title} headerContent={<StreakCounter />}>
      <CardDistributionChart />
      <ReviewHistoryChart />
      <UpcomingReviewsChart />
    </ViewLayout>
  );
}
