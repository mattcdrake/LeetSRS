import { useEffect, useState } from 'react';
import { NOTES_MAX_LENGTH } from '@/domain/cards';
import { useTimedConfirmation } from '@/entrypoints/popup/hooks/useTimedConfirmation';
import { useDeleteNoteMutation, useNoteQuery, useSaveNoteMutation } from '@/entrypoints/popup/queries/notes';

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
  const [draft, setDraft] = useState<{ slug: string; text: string } | null>(null);
  const { isConfirming, startOrConfirm, resetConfirmation } = useTimedConfirmation();

  const { data: note, isLoading, error } = useNoteQuery(slug);
  const saveNoteMutation = useSaveNoteMutation(slug);
  const deleteNoteMutation = useDeleteNoteMutation(slug);

  const text = draft?.slug === slug ? draft.text : (note ?? '');
  const setText = (text: string) => setDraft({ slug, text });

  useEffect(() => {
    setDraft((current) => (current?.slug === slug ? current : null));
    resetConfirmation();
  }, [slug, resetConfirmation]);

  const save = async () => {
    try {
      await saveNoteMutation.mutateAsync(text);
      setDraft((current) => (current?.slug === slug && current.text === text ? null : current));
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const remove = () =>
    startOrConfirm(async () => {
      saveNoteMutation.reset();
      try {
        await deleteNoteMutation.mutateAsync();
        setDraft((current) => (current?.slug === slug ? null : current));
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
