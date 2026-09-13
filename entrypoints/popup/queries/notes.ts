import { useMutation, useQuery } from '@tanstack/react-query';
import { findCard } from '@/domain/learning-document';
import { sendMessage } from '@/infrastructure/browser/messages';
import { readLearningDocument } from '@/infrastructure/storage/learning-document';
import { cardQueryKeys } from './cards';

export const noteQueryKeys = {
  all: [...cardQueryKeys.all, 'notes'] as const,
  detail: (slug: string) => [...noteQueryKeys.all, slug] as const,
};

export function useNoteQuery(slug: string) {
  return useQuery({
    queryKey: noteQueryKeys.detail(slug),
    networkMode: 'always',
    queryFn: async () => findCard(await readLearningDocument(true), slug)?.note ?? null,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveNoteMutation(slug: string) {
  return useMutation({
    mutationKey: [...noteQueryKeys.detail(slug), 'save'],
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
