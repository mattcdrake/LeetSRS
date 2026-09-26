import { type CalendarDate, getLocalTimeZone } from '@internationalized/date';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Button, Link } from 'react-aria-components';
import { LuArrowUpRight, LuCalendarCheck, LuYoutube } from 'react-icons/lu';
import { State } from 'ts-fsrs';
import { Difficulty } from '@/popup/components/Difficulty';
import { EmptyState } from '@/popup/components/EmptyState';
import { MetaItem } from '@/popup/components/MetaItem';
import { ProblemLink } from '@/popup/components/ProblemLink';
import { Tooltip } from '@/popup/components/Tooltip';
import { useI18n } from '@/popup/contexts/I18nContext';
import { cardMetadataQueryOptions } from '@/popup/queries/cards';
import { buttonInteraction, compactOutlineButton, problemRow } from '@/popup/styles';
import { addLocalDays } from '@/shared/calendar';
import type { CatalogProblem } from '@/shared/catalog';
import type { Card } from '@/shared/learning-document';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import type { ReviewCalendarDay } from '@/shared/review';
import { getProblemTitle } from '@/shared/ui/problem-title';

interface CalendarDayDetailProps {
  date: CalendarDate;
  today: CalendarDate;
  language: string;
  day: ReviewCalendarDay | undefined;
  hasReviews: boolean;
}

export function CalendarDayDetail({ date, today, language, day, hasReviews }: CalendarDayDetailProps) {
  const t = useI18n();
  const cards = day?.cards ?? [];
  const { data: metadata, error, refetch } = useQuery(cardMetadataQueryOptions(cards));
  // Overdue cards only land on today; the markers match the day's overdue count.
  const overdueSince = date.compare(today) === 0 ? today.toDate(getLocalTimeZone()).getTime() : -Infinity;
  const newCount = cards.filter((card) => card.fsrs.state === State.New && card.fsrs.due >= overdueSince).length;

  let content: ReactNode;
  if (!hasReviews) {
    content = (
      <EmptyState
        className="mt-1"
        icon={<LuCalendarCheck aria-hidden="true" className="size-4" />}
        title={t.calendar.nothingScheduled}
        description={t.calendar.nothingScheduledDescription}
      />
    );
  } else if (cards.length === 0) {
    content = <p className="py-2 text-xs text-tertiary">{t.calendar.empty}</p>;
  } else if (error) {
    content = (
      <div className="flex items-center justify-between gap-3 py-2" role="alert">
        <p className="text-xs text-danger">{t.calendar.loadFailed}</p>
        <Button className={compactOutlineButton} onPress={() => void refetch()}>
          {t.calendar.retry}
        </Button>
      </div>
    );
  } else if (!metadata) {
    content = (
      <div role="status">
        <span className="sr-only">{t.calendar.loading}</span>
        {cards.slice(0, 3).map((card) => (
          <div
            key={card.frontendId}
            aria-hidden="true"
            className="flex min-h-12 flex-col justify-center gap-1.5 py-1.5"
          >
            <span className="h-3 w-2/3 rounded bg-secondary" />
            <span className="h-2.5 w-1/4 rounded bg-secondary" />
          </div>
        ))}
      </div>
    );
  } else {
    content = (
      <ul>
        {cards.map((card) => (
          <ProblemRow
            key={card.frontendId}
            card={card}
            overdueSince={overdueSince}
            problem={metadata[card.frontendId]}
          />
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby="calendar-day-heading">
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sticky -top-4 z-[1] -mx-2 px-2 flex items-baseline justify-between gap-3 pt-3 pb-1.5 bg-primary"
      >
        <h2 id="calendar-day-heading" className="min-w-0 truncate text-[13px] font-semibold text-primary">
          <DayTitle date={date} today={today} language={language} />
        </h2>
        {!!day?.count && (
          <p className="shrink-0 whitespace-nowrap text-xs text-tertiary tabular-nums">
            <span className="font-medium text-primary">{day.count}</span> {t.calendar.dueUnit}
            {!!day.overdueCount && (
              <>
                {' · '}
                <span className="text-[var(--warning-text)]">{t.calendar.overdue(day.overdueCount)}</span>
              </>
            )}
            {!!newCount && (
              <>
                {' · '}
                <span className="text-accent">{t.calendar.new(newCount)}</span>
              </>
            )}
          </p>
        )}
      </div>
      {content}
    </section>
  );
}

function DayTitle({ date, today, language }: { date: CalendarDate; today: CalendarDate; language: string }) {
  const t = useI18n();
  const value = date.toDate(getLocalTimeZone());
  let relative: string;
  let options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  if (date.compare(today) === 0) relative = t.calendar.today;
  else if (date.compare(today.add({ days: 1 })) === 0) relative = t.calendar.tomorrow;
  else {
    relative = new Intl.DateTimeFormat(language, { weekday: 'long' }).format(value);
    options = { month: 'short', day: 'numeric' };
  }
  return (
    <>
      {relative}{' '}
      <span className="font-normal text-tertiary">{new Intl.DateTimeFormat(language, options).format(value)}</span>
    </>
  );
}

function ProblemRow({ card, overdueSince, problem }: { card: Card; overdueSince: number; problem: CatalogProblem }) {
  const t = useI18n();
  const title = getProblemTitle(problem, card.domain);
  let marker: ReactNode;
  if (card.fsrs.due < overdueSince) {
    // Round calendar-day differences so DST changes do not shift the count.
    const days = Math.round((overdueSince - addLocalDays(new Date(card.fsrs.due), 0).getTime()) / 86_400_000);
    marker = (
      <MetaItem className="text-[var(--warning-text)]">{t.calendar.overdueBy(t.format.intervalShort(days))}</MetaItem>
    );
  } else if (card.fsrs.state === State.New) {
    marker = <MetaItem className="text-accent">{t.roadmaps.new}</MetaItem>;
  }

  return (
    <li className={problemRow}>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1 text-[13px] leading-[18px]">
          <ProblemLink
            href={getLeetcodeProblemUrl({ domain: card.domain, slug: problem.slug })}
            frontendId={card.frontendId}
            title={title}
          >
            <LuArrowUpRight aria-hidden="true" className="size-3 shrink-0 text-tertiary" strokeWidth={2} />
          </ProblemLink>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-4">
          <Difficulty difficulty={problem.difficulty} />
          {marker}
        </div>
      </div>
      {problem.youtubeUrl ? (
        <Tooltip label={t.youtubeSolution}>
          <Link
            href={problem.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.youtubeSolution}
            className={`size-8 -mr-1 shrink-0 rounded-md grid place-items-center text-tertiary duration-[120ms] hover:bg-[var(--current-bg-tertiary)] hover:text-[var(--current-text-primary)] ${buttonInteraction}`}
          >
            <LuYoutube aria-hidden="true" className="size-4" strokeWidth={1.75} />
          </Link>
        </Tooltip>
      ) : (
        <span aria-hidden="true" className="size-8 -mr-1 shrink-0" />
      )}
    </li>
  );
}
