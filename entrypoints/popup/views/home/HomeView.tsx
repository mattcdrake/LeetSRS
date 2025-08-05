import { ViewLayout } from '../../components/ViewLayout';
import { StatsBar } from './StatsBar';
import { ReviewQueue } from './ReviewQueue';

export function HomeView() {
  return (
    <ViewLayout headerContent={<StatsBar />}>
      <ReviewQueue />
    </ViewLayout>
  );
}
