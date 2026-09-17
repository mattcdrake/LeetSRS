import { State } from 'ts-fsrs';
import { useReviewQueueQuery } from '@/popup/queries/cards';
import { useI18n } from '../../contexts/I18nContext';

interface StatItemProps {
  count: number;
  label: string;
  colorClass: string;
  testId: string;
}

function StatItem({ count, label, colorClass, testId }: StatItemProps) {
  return (
    <span className="flex items-center gap-1" data-testid={`stat-${testId}`}>
      <span className={`font-semibold ${colorClass}`} data-testid={`stat-${testId}-count`}>
        {count}
      </span>
      <span className="text-secondary" data-testid={`stat-${testId}-label`}>
        {label}
      </span>
    </span>
  );
}

export function StatsBar() {
  const t = useI18n();
  const { data: cards = [] } = useReviewQueueQuery();

  const newCount = cards.filter((card) => card.fsrs.state === State.New).length;
  const reviewCount = cards.length - newCount;

  return (
    <div className="flex items-center gap-2 text-sm">
      <StatItem count={reviewCount} label={t.statsBar.review} colorClass="text-info" testId="review" />
      <span className="text-tertiary">•</span>
      <StatItem count={newCount} label={t.statsBar.new} colorClass="text-accent" testId="new" />
    </div>
  );
}
