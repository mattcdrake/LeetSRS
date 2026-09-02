import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '@/shared/messages';
import { queryKeys } from '../useBackgroundQueries';

export function useNoteQuery(cardId: string) {
  return useQuery({
    queryKey: queryKeys.notes.detail(cardId),
    queryFn: () => sendMessage('getNote', { cardId }),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveNoteMutation(cardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => sendMessage('saveNote', { cardId, text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(cardId) });
    },
  });
}

export function useDeleteNoteMutation(cardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage('deleteNote', { cardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(cardId) });
    },
  });
}
