import { useMutation, useQuery } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';
import { learningDocumentQueryKey, learningDocumentQueryOptions } from './learning-document';

export function useNoteQuery(slug: string) {
  return useQuery({
    ...learningDocumentQueryOptions,
    select: ({ document }) => document.cards[slug]?.note ?? null,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveNoteMutation(slug: string) {
  return useMutation({
    mutationKey: [...learningDocumentQueryKey, 'notes', slug, 'save'],
    mutationFn: (text: string) => sendMessage('saveNote', { slug, text }),
  });
}
