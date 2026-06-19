import { useState } from 'react';
import { useReviewLogsQuery, useLanguageQuery } from '@/hooks/useBackgroundQueries';
import { useI18n } from '../../contexts/I18nContext';
import { FaChevronLeft, FaChevronRight, FaArrowUpRightFromSquare } from 'react-icons/fa6';
import { Difficulty } from '@/shared/cards';
import { Rating } from 'ts-fsrs';

const difficultyColorMap: Record<Difficulty, string> = {
  Easy: 'bg-difficulty-easy',
  Medium: 'bg-difficulty-medium',
  Hard: 'bg-difficulty-hard',
};

const ratingColorMap: Record<number, string> = {
  [Rating.Again]: 'bg-rating-again',
  [Rating.Hard]: 'bg-rating-hard',
  [Rating.Good]: 'bg-rating-good',
  [Rating.Easy]: 'bg-rating-easy',
};

const ratingLabelMap: Record<number, 'again' | 'hard' | 'good' | 'easy'> = {
  [Rating.Again]: 'again',
  [Rating.Hard]: 'hard',
  [Rating.Good]: 'good',
  [Rating.Easy]: 'easy',
};

export function CalendarSection() {
  const t = useI18n();
  const { data: language = 'en' } = useLanguageQuery();
  const { data: reviewLogs = {} } = useReviewLogsQuery();

  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed

  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const canGoNext = !isCurrentMonth;
  const canGoPrev = true;

  const handlePrevMonth = () => {
    if (canGoPrev) {
      setViewDate(new Date(year, month - 1, 1));
    }
  };

  const handleNextMonth = () => {
    if (canGoNext) {
      setViewDate(new Date(year, month + 1, 1));
    }
  };

  // Get total days in currently viewed month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Get index of the first day of the month (0 = Sunday)
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Localized weekdays starting from Sunday
  const weekdays = [];
  for (let i = 0; i < 7; i++) {
    const tempDate = new Date(2024, 0, 14 + i); // 2024-01-14 is a Sunday
    weekdays.push(tempDate.toLocaleDateString(language, { weekday: 'narrow' }));
  }

  // Localized month + year header
  const monthYearString = viewDate.toLocaleDateString(language, {
    month: 'long',
    year: 'numeric',
  });

  // Selected date details
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();
  const selectedDayNum = selectedDate.getDate();
  const selectedDateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDayNum).padStart(2, '0')}`;
  const selectedDateString = selectedDate.toLocaleDateString(language, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const dayReviews = reviewLogs[selectedDateKey] ?? [];

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-3">{t.statsView.calendarTitle}</h3>

      {/* Calendar Grid Container */}
      <div className="flex flex-col gap-2 bg-primary/40 p-3 rounded-lg border border-current/10">
        {/* Header Controls */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium capitalize">{monthYearString}</span>
          <div className="flex gap-1.5">
            <button
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              className="p-1.5 rounded hover:bg-tertiary disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              aria-label="Previous month"
            >
              <FaChevronLeft className="text-xs" />
            </button>
            <button
              onClick={handleNextMonth}
              disabled={!canGoNext}
              className="p-1.5 rounded hover:bg-tertiary disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              aria-label="Next month"
            >
              <FaChevronRight className="text-xs" />
            </button>
          </div>
        </div>

        {/* Weekdays Labels */}
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-secondary mb-1">
          {weekdays.map((day, idx) => (
            <div key={idx} className="uppercase">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1 justify-items-center">
          {/* Empty spacer cells */}
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`spacer-${idx}`} className="w-8 h-8" />
          ))}

          {/* Actual days of the month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const hasReviews = reviewLogs[dateKey] && reviewLogs[dateKey].length > 0;

            const isSelected = selectedYear === year && selectedMonth === month && selectedDayNum === dayNum;

            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === dayNum;

            return (
              <button
                key={`day-${dayNum}`}
                onClick={() => setSelectedDate(new Date(year, month, dayNum))}
                className={`w-8 h-8 rounded-full flex flex-col items-center justify-center relative text-xs font-medium cursor-pointer transition-all duration-150
                  ${isSelected ? 'bg-accent text-white font-semibold' : 'hover:bg-tertiary'}
                  ${isToday && !isSelected ? 'border border-accent/60' : ''}
                `}
              >
                <span>{dayNum}</span>
                {hasReviews && (
                  <span className={`w-1 h-1 rounded-full absolute bottom-1 ${isSelected ? 'bg-white' : 'bg-accent'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <hr className="border-current opacity-10 my-4" />

      {/* Selected Day Reviews Panel */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-secondary">{selectedDateString}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-tertiary text-secondary">
            {dayReviews.length} {dayReviews.length === 1 ? 'review' : 'reviews'}
          </span>
        </div>

        {dayReviews.length === 0 ? (
          <div className="text-center py-4 text-xs text-secondary italic">{t.statsView.noReviewsOnDay}</div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[170px] overflow-y-auto pr-1">
            {dayReviews.map((review, idx) => (
              <div
                key={`${review.cardId}-${idx}`}
                className="flex items-center justify-between py-1.5 border-b border-current/5 last:border-0 gap-2"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[9px] font-bold text-secondary font-jetbrains-mono shrink-0">
                    #{review.leetcodeId}
                  </span>
                  <a
                    href={`https://${review.domain}/problems/${review.slug}/description/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:text-accent hover:underline truncate flex items-center gap-1.5 group"
                  >
                    <span className="truncate">{review.name}</span>
                    <FaArrowUpRightFromSquare className="text-[8px] opacity-40 group-hover:opacity-100 shrink-0" />
                  </a>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`text-[8px] px-1 py-0.5 rounded text-white font-semibold ${difficultyColorMap[review.difficulty]}`}
                  >
                    {t.difficulty[review.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard']}
                  </span>
                  <span
                    className={`text-[8px] px-1 py-0.5 rounded text-white font-semibold ${ratingColorMap[review.rating]}`}
                  >
                    {t.ratings[ratingLabelMap[review.rating]]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
