import { type CalendarDate, getLocalTimeZone, parseDate } from '@internationalized/date';
import { useSuspenseQuery } from '@tanstack/react-query';
import { type ComponentProps, useContext, useState } from 'react';
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarStateContext,
  Heading,
  I18nProvider,
} from 'react-aria-components';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { ViewLayout } from '@/popup/components/ViewLayout';
import { useI18n } from '@/popup/contexts/I18nContext';
import { usePopupClock } from '@/popup/hooks/usePopupClock';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import { useSettingsQuery } from '@/popup/queries/settings';
import { buttonInteraction, compactOutlineButton } from '@/popup/styles';
import { formatLocalDate } from '@/shared/calendar';
import { buildReviewCalendar } from '@/shared/review';
import { CalendarDayDetail } from './CalendarDayDetail';
import './calendar.css';

const VISIBLE_WEEKS = 4;

const navigationButton = `size-8 rounded-md grid place-items-center text-secondary duration-[120ms] not-data-[disabled]:hover:bg-secondary not-data-[disabled]:hover:text-primary data-[disabled]:text-tertiary ${buttonInteraction} data-[disabled]:opacity-40!`;

// Maps a day's review count to a heat level from 1 to 4.
function loadLevel(count: number) {
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

export function CalendarView() {
  const t = useI18n();
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const { data: settings } = useSettingsQuery();
  const now = usePopupClock();
  const today = parseDate(formatLocalDate(new Date(now)));
  const days = buildReviewCalendar(document, new Date(now));
  const [selectedDate, setSelectedDate] = useState(today);
  const [focusedDate, setFocusedDate] = useState(today);
  const activeDate = selectedDate.compare(today) < 0 ? today : selectedDate;

  return (
    <ViewLayout title={t.nav.calendar}>
      <I18nProvider locale={settings.language}>
        <Calendar
          aria-label={t.nav.calendar}
          className="review-calendar"
          visibleDuration={{ weeks: VISIBLE_WEEKS }}
          // Without this, the grid renders as many rows as the first visible month has weeks.
          weeksInMonth={VISIBLE_WEEKS}
          minValue={today}
          value={activeDate}
          onChange={setSelectedDate}
          focusedValue={focusedDate.compare(today) < 0 ? today : focusedDate}
          onFocusChange={setFocusedDate}
        >
          <header className="flex items-center gap-1 h-8">
            <RangeHeading language={settings.language} />
            <TodayButton
              today={today}
              isSelected={activeDate.compare(today) === 0}
              onPress={() => {
                setSelectedDate(today);
                setFocusedDate(today);
              }}
            />
            <div className="flex items-center -mr-1.5">
              <Button slot="previous" aria-label={t.calendar.previousPage} className={navigationButton}>
                <LuChevronLeft aria-hidden="true" className="size-4" />
              </Button>
              <Button slot="next" aria-label={t.calendar.nextPage} className={navigationButton}>
                <LuChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </header>
          <div className="mt-2 rounded-xl border border-current bg-surface shadow-card px-1 pb-1">
            <CalendarGrid
              className="calendar-grid"
              weekdayStyle="short"
              // React Aria labels the grid through the end of its first month only.
              render={(props) => <VisibleRangeGrid {...props} language={settings.language} />}
            >
              <CalendarGridHeader>
                {(day) => <CalendarHeaderCell className="calendar-weekday">{day}</CalendarHeaderCell>}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => {
                  const day = days[date.toString()];
                  const count = day?.count ?? 0;
                  const overdueCount = day?.overdueCount ?? 0;
                  const isFirstOfMonth = date.day === 1;
                  return (
                    <CalendarCell
                      date={date}
                      className="calendar-day"
                      data-load={count > 0 ? loadLevel(count) : undefined}
                      data-overdue={overdueCount > 0 || undefined}
                      data-month-start={isFirstOfMonth || undefined}
                      render={(props) => (
                        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: React Aria supplies the button role and keyboard behavior.
                        <div
                          {...props}
                          aria-label={[
                            props['aria-label'],
                            t.calendar.due(count),
                            ...(overdueCount > 0 ? [t.calendar.overdue(overdueCount)] : []),
                          ].join(', ')}
                        />
                      )}
                    >
                      {({ formattedDate }) =>
                        isFirstOfMonth ? t.calendar.monthStart(date.toDate(getLocalTimeZone())) : formattedDate
                      }
                    </CalendarCell>
                  );
                }}
              </CalendarGridBody>
            </CalendarGrid>
          </div>
        </Calendar>
        <CalendarDayDetail
          date={activeDate}
          today={today}
          language={settings.language}
          day={days[activeDate.toString()]}
          hasReviews={Object.keys(days).length > 0}
        />
      </I18nProvider>
    </ViewLayout>
  );
}

function VisibleRangeGrid({ language, ...props }: ComponentProps<'table'> & { language: string }) {
  const t = useI18n();
  const range = useVisibleRange(language, { month: 'long', day: 'numeric', year: 'numeric' });
  return <table {...props} aria-label={`${t.nav.calendar}, ${range}`} />;
}

function useVisibleRange(language: string, options: Intl.DateTimeFormatOptions) {
  const state = useContext(CalendarStateContext);
  if (!state) return '';
  const timeZone = getLocalTimeZone();
  const { start, end } = state.visibleRange;
  return new Intl.DateTimeFormat(language, options).formatRange(start.toDate(timeZone), end.toDate(timeZone));
}

// React Aria's default heading spells out months and the year, which crowds the header.
function RangeHeading({ language }: { language: string }) {
  const range = useVisibleRange(language, { month: 'short', day: 'numeric' });
  return (
    <Heading className="flex-1 min-w-0 truncate text-[15px] font-semibold tracking-tight text-primary">{range}</Heading>
  );
}

function TodayButton({
  today,
  isSelected,
  onPress,
}: {
  today: CalendarDate;
  isSelected: boolean;
  onPress: () => void;
}) {
  const t = useI18n();
  const state = useContext(CalendarStateContext);
  const showsToday =
    !!state && today.compare(state.visibleRange.start) >= 0 && today.compare(state.visibleRange.end) <= 0;
  return (
    <Button
      slot={null}
      className={`${compactOutlineButton} ${isSelected && showsToday ? 'text-tertiary!' : ''}`}
      onPress={onPress}
    >
      {t.calendar.today}
    </Button>
  );
}
