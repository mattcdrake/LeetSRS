import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { FaArrowUpRightFromSquare } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import { cardMetadataQueryOptions } from '@/popup/queries/cards';
import { rowActionSpacing } from '@/popup/styles';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import type { ReviewCalendarDay } from '@/shared/review';
import { DIFFICULTY_COLORS } from '@/shared/ui/difficulty-colors';
import { getProblemTitle } from '@/shared/ui/problem-title';
import { YouTubeLink } from '@/shared/ui/YouTubeLink';

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
            <li key={card.frontendId} className="flex items-center gap-2 border-b border-current last:border-b-0">
              <a
                className="min-w-0 flex-1 break-words py-2 text-xs text-primary hover:text-accent focus-visible:outline-2 focus-visible:outline-current"
                href={getLeetcodeProblemUrl({ domain: card.domain, slug: problem.slug })}
                target="_blank"
                rel="noopener noreferrer"
              >
                {card.frontendId}. {getProblemTitle(problem, card.domain)}
              </a>
              <div className={`flex shrink-0 items-center ${rowActionSpacing}`}>
                <span className="px-2 text-xs capitalize" style={{ color: DIFFICULTY_COLORS[problem.difficulty] }}>
                  {problem.difficulty}
                </span>
                <YouTubeLink url={problem.youtubeUrl} label={t.youtubeSolution} />
                <a
                  href={getLeetcodeProblemUrl({ domain: card.domain, slug: problem.slug })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary transition-colors focus-visible:outline-2"
                  aria-label={`Open ${getProblemTitle(problem, card.domain)} on LeetCode`}
                >
                  <FaArrowUpRightFromSquare aria-hidden="true" className="size-4" />
                </a>
              </div>
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
