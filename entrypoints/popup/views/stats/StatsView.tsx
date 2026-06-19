import { ViewLayout } from '../../components/ViewLayout';
import { StreakCounter } from '../../components/StreakCounter';
import { CalendarSection } from './CalendarSection';
import { CardDistributionChart } from './CardDistributionChart';
import { ReviewHistoryChart } from './ReviewHistoryChart';
import { UpcomingReviewsChart } from './UpcomingReviewsChart';
import { useI18n } from '../../contexts/I18nContext';

export function StatsView() {
  const t = useI18n();
  return (
    <ViewLayout title={t.statsView.title} headerContent={<StreakCounter />}>
      <CalendarSection />
      <CardDistributionChart />
      <ReviewHistoryChart />
      <UpcomingReviewsChart />
    </ViewLayout>
  );
}
