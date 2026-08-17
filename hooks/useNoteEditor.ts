import { useState, useEffect } from 'react';
import { useNoteQuery, useSaveNoteMutation, useDeleteNoteMutation } from '@/hooks/useBackgroundQueries';
import { NOTES_MAX_LENGTH } from '@/shared/notes';

const DELETE_CONFIRM_TIMEOUT_MS = 3000;

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
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: note, isLoading, error } = useNoteQuery(cardId);
  const saveNoteMutation = useSaveNoteMutation(cardId);
  const deleteNoteMutation = useDeleteNoteMutation(cardId);

  // Sync fetched note with local state
  useEffect(() => {
    setText(note?.text ?? '');
    setDeleteConfirm(false);
  }, [note]);

  // Auto-reset delete confirmation after a delay
  useEffect(() => {
    if (!deleteConfirm) {
      return;
    }

    const timer = setTimeout(() => {
      setDeleteConfirm(false);
    }, DELETE_CONFIRM_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [deleteConfirm]);

  const save = async () => {
    try {
      await saveNoteMutation.mutateAsync(text);
    } catch (error) {
      console.error('Failed to save note:', error);
      // Revert to original text on error
      setText(note?.text ?? '');
    }
  };

  const remove = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    try {
      await deleteNoteMutation.mutateAsync();
      setText('');
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setDeleteConfirm(false);
    }
  };

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
    deleteConfirm,
    isLoading,
    isSaving: saveNoteMutation.isPending,
    isDeleting: deleteNoteMutation.isPending,
    error,
  };
}
