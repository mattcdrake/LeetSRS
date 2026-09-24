import { useQuery } from '@tanstack/react-query';
import { background } from '@/shared/background-service';
import { learningDocumentQueryOptions, useDocumentMutation } from './learning-document';

export function useNoteQuery(frontendId: string) {
  return useQuery({
    ...learningDocumentQueryOptions,
    select: (document) => document.cards[frontendId]?.note ?? null,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveNoteMutation(frontendId: string) {
  return useDocumentMutation((text: string) => background.saveNote(frontendId, text));
}
