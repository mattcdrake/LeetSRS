import { queryOptions } from '@tanstack/react-query';
import type { LearningDocument } from '@/shared/models';
import { readLearningDocument } from '@/shared/storage';

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
