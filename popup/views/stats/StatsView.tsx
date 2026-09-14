import { StreakCounter } from '../../components/StreakCounter';
import { ViewLayout } from '../../components/ViewLayout';
import { useI18n } from '../../contexts/I18nContext';

export function StatsView() {
  const t = useI18n();
  return (
    <ViewLayout title={t.statsView.title} headerContent={<StreakCounter />}>
      {null}
    </ViewLayout>
  );
}
