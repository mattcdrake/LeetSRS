import { queryOptions } from '@tanstack/react-query';
import { readLearningDocument } from '@/data/learning-document';
import type { LearningDocument } from '@/domain/learning-document';

export const learningDocumentQueryKey = ['popupLearningDocument'] as const;

export interface PopupLearningDocumentSnapshot {
  document: LearningDocument;
  now: Date;
}

export const learningDocumentQueryOptions = queryOptions({
  queryKey: learningDocumentQueryKey,
  queryFn: async () => {
    const now = new Date();
    const document = await readLearningDocument(true);
    return { document, now } satisfies PopupLearningDocumentSnapshot;
  },
  refetchOnMount: false,
  refetchInterval: 15_000,
});
