import { State } from 'ts-fsrs';
import { useReviewQueueQuery } from '@/popup/queries/cards';
import { useI18n } from '../../contexts/I18nContext';

interface StatItemProps {
  count: number;
  label: string;
  dotColor: string;
  testId: string;
}

function StatItem({ count, label, dotColor, testId }: StatItemProps) {
  return (
    <span className="flex items-center gap-1.5" data-testid={`stat-${testId}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: dotColor }} />
      <span className="font-semibold text-primary" data-testid={`stat-${testId}-count`}>
        {count}
      </span>
      <span data-testid={`stat-${testId}-label`}>{label}</span>
    </span>
  );
}

export function StatsBar() {
  const t = useI18n();
  const { data: cards = [] } = useReviewQueueQuery();

  const newCount = cards.filter((card) => card.fsrs.state === State.New).length;
  const reviewCount = cards.length - newCount;

  return (
    <div className="flex items-center gap-3 text-xs text-secondary tabular-nums">
      <StatItem count={reviewCount} label={t.statsBar.review} dotColor="var(--current-info)" testId="review" />
      <StatItem count={newCount} label={t.statsBar.new} dotColor="var(--current-accent)" testId="new" />
    </div>
  );
}
