import { addLocalDays, formatLocalDate } from '@/shared/calendar';
import type { ReviewActivity } from '@/shared/learning-document';

export function recordReview(activity: ReviewActivity | null, now: Date, isNewCard: boolean): ReviewActivity {
  const today = formatLocalDate(now);
  const sameDay = activity?.date === today;
  const yesterday = formatLocalDate(addLocalDays(now, -1));
  return {
    date: today,
    newCards: (sameDay ? activity.newCards : 0) + (isNewCard ? 1 : 0),
    streak: sameDay ? activity.streak : activity?.date === yesterday ? activity.streak + 1 : 1,
  };
}
