import { queryOptions, type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { readLearningDocument } from '@/shared/learning-document';

export const learningDocumentQueryKey = ['popupLearningDocument'] as const;

export const learningDocumentQueryOptions = queryOptions({
  queryKey: learningDocumentQueryKey,
  queryFn: readLearningDocument,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
});

// Refetch the document after every write so the popup reflects it without waiting for the storage watcher.
export function useDocumentMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  options?: Pick<UseMutationOptions<TResult, Error, TVariables>, 'scope'>
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    ...options,
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: learningDocumentQueryKey }),
  });
}
