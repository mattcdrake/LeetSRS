import { useEffect } from 'react';
import { NOTES_MAX_LENGTH } from '@/domain/cards';
import { useDraftUntilSaved } from '@/popup/hooks/useDraftUntilSaved';
import { useTimedConfirmation } from '@/popup/hooks/useTimedConfirmation';
import { useDeleteNoteMutation, useNoteQuery, useSaveNoteMutation } from '@/popup/queries/notes';

export interface NoteEditor {
  text: string;
  setText: (text: string) => void;
  save: () => Promise<void>;
  remove: () => Promise<void>; // two-step: first call arms, second deletes
  canSave: boolean;
  isOverLimit: boolean;
  characterCount: number;
  hasExistingNote: boolean;
  deleteConfirm: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  saveError: unknown;
  error: unknown;
}

export function useNoteEditor(slug: string): NoteEditor {
  const { isConfirming, startOrConfirm, resetConfirmation } = useTimedConfirmation();

  const { data: note, isLoading, error } = useNoteQuery(slug);
  const saveNoteMutation = useSaveNoteMutation(slug);
  const deleteNoteMutation = useDeleteNoteMutation(slug);

  const draft = useDraftUntilSaved(slug, note ?? '');
  const { value: text, setValue: setText } = draft;

  // biome-ignore lint/correctness/useExhaustiveDependencies: Switching cards must clear the deletion confirmation.
  useEffect(() => {
    resetConfirmation();
  }, [slug, resetConfirmation]);

  const save = async () => {
    try {
      await saveNoteMutation.mutateAsync(text);
      draft.markSaved();
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const remove = () =>
    startOrConfirm(async () => {
      saveNoteMutation.reset();
      try {
        await deleteNoteMutation.mutateAsync();
        draft.discard();
      } catch (error) {
        console.error('Failed to delete note:', error);
      }
    });

  const originalText = note ?? '';
  const characterCount = text.length;
  const isOverLimit = characterCount > NOTES_MAX_LENGTH;
  const hasChanges = text !== originalText;

  return {
    text,
    setText,
    save,
    remove,
    canSave: hasChanges && !isOverLimit && text.length > 0,
    isOverLimit,
    characterCount,
    hasExistingNote: note != null,
    deleteConfirm: isConfirming,
    isLoading,
    isSaving: saveNoteMutation.isPending,
    isDeleting: deleteNoteMutation.isPending,
    saveError: saveNoteMutation.error,
    error,
  };
}
