import { State as FsrsState } from 'ts-fsrs';
import { addLocalDays, formatLocalDate } from '@/shared/calendar';
import type { Card, LearningDocument } from '@/shared/models';
import { DEFAULT_SETTINGS } from '@/shared/settings';

function getNewCardAllowance(document: LearningDocument, now: Date): number {
  const maxNewCardsPerDay = document.settings.maxNewCardsPerDay ?? DEFAULT_SETTINGS.maxNewCardsPerDay;
  const newCardsCompletedToday =
    document.reviewActivity?.date === formatLocalDate(now) ? document.reviewActivity.newCards : 0;
  return Math.max(0, maxNewCardsPerDay - newCardsCompletedToday);
}

function getActiveCardsByDueDate(document: LearningDocument): Card[] {
  return Object.values(document.cards)
    .filter((card) => !card.paused)
    .sort((a, b) => a.fsrs.due - b.fsrs.due);
}

export function buildReviewQueue(document: LearningDocument, now: Date): Card[] {
  const eligibleCards = getActiveCardsByDueDate(document).filter((card) => card.fsrs.due <= now.getTime());
  let remainingNewCards = getNewCardAllowance(document, now);
  const queue: Card[] = [];
  for (const card of eligibleCards) {
    if (card.fsrs.state === FsrsState.New) {
      if (remainingNewCards === 0) continue;
      remainingNewCards--;
    }
    queue.push(card);
  }
  return queue;
}

export interface ReviewCalendarDay {
  cards: Card[];
  count: number;
  overdueCount: number;
}

/** Local YYYY-MM-DD buckets; absent days are empty. Stored due dates are never changed. */
export function buildReviewCalendar(document: LearningDocument, now: Date): Record<string, ReviewCalendarDay> {
  const calendar: Record<string, ReviewCalendarDay> = {};
  const today = addLocalDays(now, 0);
  const maxNewCardsPerDay = document.settings.maxNewCardsPerDay ?? DEFAULT_SETTINGS.maxNewCardsPerDay;
  let newCardDay = today;
  let allowance = getNewCardAllowance(document, now);

  for (const card of getActiveCardsByDueDate(document)) {
    let day = addLocalDays(new Date(Math.max(today.getTime(), card.fsrs.due)), 0);
    if (card.fsrs.state === FsrsState.New) {
      if (maxNewCardsPerDay === 0) continue;
      if (day > newCardDay) {
        newCardDay = day;
        allowance = maxNewCardsPerDay;
      }
      if (allowance === 0) {
        newCardDay = addLocalDays(newCardDay, 1);
        allowance = maxNewCardsPerDay;
      }
      day = newCardDay;
      allowance--;
    }

    const key = formatLocalDate(day);
    calendar[key] ??= { cards: [], count: 0, overdueCount: 0 };
    const bucket = calendar[key];
    bucket.cards.push(card);
    bucket.count++;
    if (day.getTime() === today.getTime() && card.fsrs.due < today.getTime()) bucket.overdueCount++;
  }

  return calendar;
}
