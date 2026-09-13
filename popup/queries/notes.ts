import { useMutation, useQuery } from '@tanstack/react-query';
import { sendMessage } from '@/integrations/browser/messages';
import { cardQueryKeys, cardsQueryOptions } from './cards';

export function useNoteQuery(slug: string) {
  return useQuery({
    ...cardsQueryOptions,
    select: (cards) => cards.find((card) => card.slug === slug)?.note ?? null,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveNoteMutation(slug: string) {
  return useMutation({
    mutationKey: [...cardQueryKeys.all, 'notes', slug, 'save'],
    networkMode: 'always',
    mutationFn: (text: string) => sendMessage('saveNote', { slug, text }),
  });
}

export function useDeleteNoteMutation(slug: string) {
  return useMutation({
    networkMode: 'always',
    mutationFn: () => sendMessage('deleteNote', { slug }),
  });
}
