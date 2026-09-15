import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';
import { learningDocumentQueryKey, learningDocumentQueryOptions } from './learning-document';

export function useNoteQuery(frontendId: string) {
  return useQuery({
    ...learningDocumentQueryOptions,
    select: ({ document }) => document.cards[frontendId]?.note ?? null,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveNoteMutation(frontendId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...learningDocumentQueryKey, 'notes', frontendId, 'save'],
    mutationFn: (text: string) => sendMessage('saveNote', { frontendId, text }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: learningDocumentQueryKey }),
  });
}
