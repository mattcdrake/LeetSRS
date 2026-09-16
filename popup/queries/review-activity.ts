import { useQuery } from '@tanstack/react-query';
import { formatLocalDate } from '@/shared/calendar';
import { usePopupClock } from '../hooks/usePopupClock';
import { learningDocumentQueryOptions } from './learning-document';

export function useTodayReviewActivityQuery() {
  const now = usePopupClock();
  return useQuery({
    ...learningDocumentQueryOptions,
    select: (document) =>
      document.reviewActivity?.date === formatLocalDate(new Date(now)) ? document.reviewActivity : null,
  });
}
