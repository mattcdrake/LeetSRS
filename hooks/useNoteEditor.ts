import { useEffect, useState } from 'react';
import { useDeleteNoteMutation, useNoteQuery, useSaveNoteMutation } from '@/hooks/queries/notes';
import { useTimedConfirmation } from '@/hooks/useTimedConfirmation';
import { NOTES_MAX_LENGTH } from '@/shared/notes';

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
  error: unknown;
}

export function useNoteEditor(cardId: string): NoteEditor {
  const [text, setText] = useState('');
  const { isConfirming, startOrConfirm, resetConfirmation } = useTimedConfirmation();

  const { data: note, isLoading, error } = useNoteQuery(cardId);
  const saveNoteMutation = useSaveNoteMutation(cardId);
  const deleteNoteMutation = useDeleteNoteMutation(cardId);

  // Sync fetched note with local state
  useEffect(() => {
    setText(note?.text ?? '');
    resetConfirmation();
  }, [note, resetConfirmation]);

  const save = async () => {
    try {
      await saveNoteMutation.mutateAsync(text);
    } catch (error) {
      console.error('Failed to save note:', error);
      // Revert to original text on error
      setText(note?.text ?? '');
    }
  };

  const remove = () =>
    startOrConfirm(async () => {
      try {
        await deleteNoteMutation.mutateAsync();
        setText('');
      } catch (error) {
        console.error('Failed to delete note:', error);
      }
    });

  const originalText = note?.text ?? '';
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
    error,
  };
}
