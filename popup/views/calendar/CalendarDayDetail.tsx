import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { FaArrowUpRightFromSquare } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import { cardMetadataQueryOptions } from '@/popup/queries/cards';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import type { ReviewCalendarDay } from '@/shared/review';
import { DIFFICULTY_COLORS } from '@/shared/ui/difficulty-colors';
import { getProblemTitle } from '@/shared/ui/problem-title';

interface CalendarDayDetailProps {
  dateLabel: string;
  day: ReviewCalendarDay | undefined;
}

export function CalendarDayDetail({ dateLabel, day }: CalendarDayDetailProps) {
  const t = useI18n();
  const cards = day?.cards ?? [];
  const { data: metadata, error } = useQuery(cardMetadataQueryOptions(cards));

  let content: ReactNode;
  if (cards.length === 0) {
    content = <p className="py-4 text-xs text-secondary text-center">{t.calendar.empty}</p>;
  } else if (error) {
    content = (
      <p className="py-4 text-xs text-danger" role="alert">
        {t.calendar.loadFailed}
      </p>
    );
  } else if (!metadata) {
    content = (
      <p className="py-4 text-xs text-secondary" role="status">
        {t.calendar.loading}
      </p>
    );
  } else {
    content = (
      <ul>
        {cards.map((card) => {
          const problem = metadata[card.frontendId];
          return (
            <li key={card.frontendId} className="border-b border-current last:border-b-0">
              <a
                className="group flex items-baseline gap-2 py-2 text-xs text-primary hover:text-accent focus-visible:outline-2 focus-visible:outline-current"
                href={getLeetcodeProblemUrl({ domain: card.domain, slug: problem.slug })}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="min-w-0 flex-1 break-words">
                  {card.frontendId}. {getProblemTitle(problem, card.domain)}
                </span>
                <span
                  className="shrink-0 text-[11px] capitalize"
                  style={{ color: DIFFICULTY_COLORS[problem.difficulty] }}
                >
                  {problem.difficulty}
                </span>
                <FaArrowUpRightFromSquare
                  aria-hidden="true"
                  className="shrink-0 text-[10px] opacity-60 group-hover:opacity-100"
                />
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="mt-3 border-t border-current pt-3" aria-labelledby="calendar-day-heading">
      <div aria-live="polite" aria-atomic="true" className="mb-1">
        <h2 id="calendar-day-heading" className="text-sm font-semibold">
          {dateLabel}
        </h2>
        <p className="text-xs text-secondary mt-1">
          {t.calendar.due(day?.count ?? 0)}
          {!!day?.overdueCount && <span> · {t.calendar.overdue(day.overdueCount)}</span>}
        </p>
      </div>
      {content}
    </section>
  );
}
