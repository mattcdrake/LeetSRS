import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '@/infrastructure/browser/messages';
import { cardQueryKeys } from './cards';

export const noteQueryKeys = {
  all: [...cardQueryKeys.all, 'notes'] as const,
  detail: (slug: string) => [...noteQueryKeys.all, slug] as const,
};

export function useNoteQuery(slug: string) {
  return useQuery({
    queryKey: noteQueryKeys.detail(slug),
    queryFn: () => sendMessage('getNote', { slug }),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveNoteMutation(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => sendMessage('saveNote', { slug, text }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardQueryKeys.all }),
  });
}

export function useDeleteNoteMutation(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendMessage('deleteNote', { slug }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardQueryKeys.all }),
  });
}
