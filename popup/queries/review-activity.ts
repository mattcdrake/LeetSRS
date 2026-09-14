import { useQuery } from '@tanstack/react-query';
import { formatLocalDate } from '@/shared/calendar';
import { learningDocumentQueryOptions } from './learning-document';

export function useTodayReviewActivityQuery() {
  return useQuery({
    ...learningDocumentQueryOptions,
    select: ({ document, now }) =>
      document.reviewActivity?.date === formatLocalDate(now) ? document.reviewActivity : null,
  });
}
