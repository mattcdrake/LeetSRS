import { queryOptions } from '@tanstack/react-query';
import { readLearningDocument } from '@/shared/learning-document';

export const learningDocumentQueryKey = ['popupLearningDocument'] as const;

export const learningDocumentQueryOptions = queryOptions({
  queryKey: learningDocumentQueryKey,
  queryFn: readLearningDocument,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
});
