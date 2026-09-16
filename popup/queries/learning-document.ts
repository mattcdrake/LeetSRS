import { queryOptions } from '@tanstack/react-query';
import { readLearningDocument } from '@/shared/storage';

export const learningDocumentQueryKey = ['popupLearningDocument'] as const;

export const learningDocumentQueryOptions = queryOptions({
  queryKey: learningDocumentQueryKey,
  queryFn: readLearningDocument,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
});
