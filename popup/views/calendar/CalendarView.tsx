import { parseDate } from '@internationalized/date';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Heading,
  I18nProvider,
} from 'react-aria-components';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa6';
import { ViewLayout } from '@/popup/components/ViewLayout';
import { useI18n } from '@/popup/contexts/I18nContext';
import { usePopupClock } from '@/popup/hooks/usePopupClock';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import { useSettingsQuery } from '@/popup/queries/settings';
import { buttonInteraction } from '@/popup/styles';
import { formatLocalDate } from '@/shared/calendar';
import { buildReviewCalendar } from '@/shared/review';
import './calendar.css';

export function CalendarView() {
  const t = useI18n();
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const { data: settings } = useSettingsQuery();
  const now = usePopupClock();
  const today = parseDate(formatLocalDate(new Date(now)));
  const days = buildReviewCalendar(document, new Date(now));
  const [selectedDate, setSelectedDate] = useState(today);
  const [focusedDate, setFocusedDate] = useState(today);

  return (
    <ViewLayout title={t.nav.calendar}>
      <I18nProvider locale={settings.language}>
        <Calendar
          aria-label={t.nav.calendar}
          className="review-calendar"
          minValue={today}
          value={selectedDate.compare(today) < 0 ? today : selectedDate}
          onChange={setSelectedDate}
          focusedValue={focusedDate.compare(today) < 0 ? today : focusedDate}
          onFocusChange={setFocusedDate}
        >
          <header className="flex items-center gap-1 mb-2">
            <Heading className="flex-1 text-sm font-semibold" />
            <Button
              slot={null}
              className={`calendar-today ${buttonInteraction}`}
              onPress={() => {
                setSelectedDate(today);
                setFocusedDate(today);
              }}
            >
              {t.calendar.today}
            </Button>
            <Button
              slot="previous"
              aria-label={t.calendar.previousMonth}
              className={`calendar-navigation ${buttonInteraction}`}
            >
              <FaChevronLeft aria-hidden="true" />
            </Button>
            <Button
              slot="next"
              aria-label={t.calendar.nextMonth}
              className={`calendar-navigation ${buttonInteraction}`}
            >
              <FaChevronRight aria-hidden="true" />
            </Button>
          </header>
          <CalendarGrid className="calendar-grid" weekdayStyle="short">
            <CalendarGridHeader>
              {(day) => <CalendarHeaderCell className="calendar-weekday">{day}</CalendarHeaderCell>}
            </CalendarGridHeader>
            <CalendarGridBody>
              {(date) => {
                const count = days[date.toString()]?.count ?? 0;
                return (
                  <CalendarCell
                    date={date}
                    className="calendar-day"
                    data-has-due={count > 0 || undefined}
                    render={(props) => (
                      // biome-ignore lint/a11y/useAriaPropsSupportedByRole: React Aria supplies the button role and keyboard behavior.
                      <div {...props} aria-label={`${props['aria-label']}, ${t.calendar.due(count)}`} />
                    )}
                  >
                    {({ formattedDate }) => (
                      <>
                        <span className="calendar-date">{formattedDate}</span>
                        {count > 0 && <span className="calendar-count">{t.calendar.due(count)}</span>}
                      </>
                    )}
                  </CalendarCell>
                );
              }}
            </CalendarGridBody>
          </CalendarGrid>
        </Calendar>
      </I18nProvider>
    </ViewLayout>
  );
}
