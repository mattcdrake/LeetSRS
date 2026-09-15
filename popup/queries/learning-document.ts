import { queryOptions } from '@tanstack/react-query';
import type { LearningDocument } from '@/shared/models';
import { readLearningDocument } from '@/shared/storage';

export const learningDocumentQueryKey = ['popupLearningDocument'] as const;

export interface PopupLearningDocumentSnapshot {
  document: LearningDocument;
  now: Date;
}

export async function readPopupLearningDocument(): Promise<PopupLearningDocumentSnapshot> {
  const now = new Date();
  const document = await readLearningDocument();
  return { document, now };
}

export const learningDocumentQueryOptions = queryOptions({
  queryKey: learningDocumentQueryKey,
  queryFn: readPopupLearningDocument,
  refetchOnMount: false,
  refetchInterval: 15_000,
});
