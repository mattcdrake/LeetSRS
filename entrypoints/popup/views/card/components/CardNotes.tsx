import { useState, useEffect, useRef } from 'react';
import { Button, TextField, TextArea, Label } from 'react-aria-components';
import { useNoteQuery, useSaveNoteMutation, useDeleteNoteMutation } from '@/hooks/useBackgroundQueries';
import { NOTES_MAX_LENGTH } from '@/shared/notes';
import { bounceButton } from '@/shared/styles';
import { useI18n } from '../../../contexts/I18nContext';

interface CardNotesProps {
  cardId: string;
}

export function CardNotes({ cardId }: CardNotesProps) {
  const t = useI18n();
  const [noteText, setNoteText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: note, isLoading } = useNoteQuery(cardId);
  const saveNoteMutation = useSaveNoteMutation(cardId);
  const deleteNoteMutation = useDeleteNoteMutation(cardId);

  // Sync fetched note with local state
  useEffect(() => {
    const text = note?.text || '';
    setNoteText(text);
    setDeleteConfirm(false);
  }, [note]);

  // Adjust height when note text changes (including initial load)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [noteText]);

  // Auto-reset delete confirmation after a delay
  useEffect(() => {
    if (!deleteConfirm) {
      return;
    }

    const timer = setTimeout(() => {
      setDeleteConfirm(false);
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [deleteConfirm]);

  const handleSave = async () => {
    try {
      await saveNoteMutation.mutateAsync(noteText);
    } catch (error) {
      console.error('Failed to save note:', error);
      setNoteText(note?.text || '');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    try {
      await deleteNoteMutation.mutateAsync();
      setNoteText('');
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setDeleteConfirm(false);
    }
  };

  const originalText = note?.text || '';
  const characterCount = noteText.length;
  const isOverLimit = characterCount > NOTES_MAX_LENGTH;
  const hasChanges = noteText !== originalText;
  const canSave = hasChanges && !isOverLimit;
  const hasExistingNote = note != null;

  return (
    <div className="mt-3 pt-3 border-t border-current">
      <span className="text-xs text-secondary">{t.notes.title}</span>
      <TextField className="w-full">
        <Label className="sr-only">{t.notes.ariaLabel}</Label>
        <TextArea
          ref={textareaRef}
          className="w-full mt-1.5 p-2 rounded border border-current bg-tertiary text-primary text-xs resize-none focus:outline-none focus:ring-1 focus:ring-accent overflow-hidden"
          placeholder={isLoading ? t.notes.placeholderLoading : t.notes.placeholderEmpty}
          rows={1}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          disabled={isLoading || saveNoteMutation.isPending}
          maxLength={NOTES_MAX_LENGTH}
        />
      </TextField>
      <div className="mt-1.5 flex items-center justify-between">
        <span className={`text-xs ${isOverLimit ? 'text-danger' : 'text-secondary'}`}>
          {t.format.characterCount(characterCount, NOTES_MAX_LENGTH)}
        </span>
        <div className="flex gap-2">
          {hasExistingNote && (
            <Button
              className={`px-3 py-1 rounded text-xs ${deleteConfirm ? 'bg-ultra-danger' : 'bg-danger'} text-white hover:opacity-90 data-[disabled]:opacity-50 ${bounceButton}`}
              onPress={handleDelete}
              isDisabled={deleteNoteMutation.isPending}
            >
              {deleteNoteMutation.isPending ? t.actions.deleting : deleteConfirm ? t.actions.confirm : t.actions.delete}
            </Button>
          )}
          <Button
            className={`px-3 py-1 rounded text-xs bg-accent text-white hover:opacity-90 data-[disabled]:opacity-50 ${bounceButton}`}
            onPress={handleSave}
            isDisabled={!canSave || saveNoteMutation.isPending}
          >
            {saveNoteMutation.isPending ? t.actions.saving : t.actions.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
