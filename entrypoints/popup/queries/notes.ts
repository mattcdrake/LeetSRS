import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';

export const noteQueryKeys = {
  all: ['notes'] as const,
  detail: (cardId: string) => ['notes', cardId] as const,
};

export function useNoteQuery(cardId: string) {
  return useQuery({
    queryKey: noteQueryKeys.detail(cardId),
    queryFn: () => sendMessage('getNote', { cardId }),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveNoteMutation(cardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => sendMessage('saveNote', { cardId, text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteQueryKeys.detail(cardId) });
    },
  });
}

export function useDeleteNoteMutation(cardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage('deleteNote', { cardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteQueryKeys.detail(cardId) });
    },
  });
}
