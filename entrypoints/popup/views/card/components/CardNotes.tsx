import { useState, useEffect, useRef } from 'react';
import { Button, TextField, TextArea, Label } from 'react-aria-components';
import { useNoteQuery, useSaveNoteMutation, useDeleteNoteMutation } from '@/hooks/useBackgroundQueries';
import { NOTES_MAX_LENGTH } from '@/shared/notes';
import { bounceButton } from '@/shared/styles';
import { i18n } from '@/shared/i18n';

interface CardNotesProps {
  cardId: string;
}

export function CardNotes({ cardId }: CardNotesProps) {
  const [noteText, setNoteText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: note, isLoading } = useNoteQuery(cardId);
  const saveNoteMutation = useSaveNoteMutation(cardId);
  const deleteNoteMutation = useDeleteNoteMutation(cardId);

  // Auto-resize textarea
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Sync fetched note with local state
  useEffect(() => {
    const text = note?.text || '';
    setNoteText(text);
    setDeleteConfirm(false);
  }, [note]);

  // Adjust height when note text changes (including initial load)
  useEffect(() => {
    adjustHeight();
  }, [noteText]);

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
      setTimeout(() => setDeleteConfirm(false), 3000);
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
  const canSave = hasChanges && !isOverLimit && noteText.length > 0;
  const hasExistingNote = originalText.length > 0;

  return (
    <div className="mt-3 pt-3 border-t border-current">
      <span className="text-xs text-secondary">{i18n.notes.title}</span>
      <TextField className="w-full">
        <Label className="sr-only">{i18n.notes.ariaLabel}</Label>
        <TextArea
          ref={textareaRef}
          className="w-full mt-1.5 p-2 rounded border border-current bg-tertiary text-primary text-xs resize-none focus:outline-none focus:ring-1 focus:ring-accent overflow-hidden"
          placeholder={isLoading ? i18n.notes.placeholderLoading : i18n.notes.placeholderEmpty}
          rows={1}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          disabled={isLoading || saveNoteMutation.isPending}
          maxLength={NOTES_MAX_LENGTH + 100}
        />
      </TextField>
      <div className="mt-1.5 flex items-center justify-between">
        <span className={`text-xs ${isOverLimit ? 'text-danger' : 'text-secondary'}`}>
          {i18n.format.characterCount(characterCount, NOTES_MAX_LENGTH)}
        </span>
        <div className="flex gap-2">
          {hasExistingNote && (
            <Button
              className={`px-3 py-1 rounded text-xs ${deleteConfirm ? 'bg-ultra-danger' : 'bg-danger'} text-white hover:opacity-90 data-[disabled]:opacity-50 ${bounceButton}`}
              onPress={handleDelete}
              isDisabled={deleteNoteMutation.isPending}
            >
              {deleteNoteMutation.isPending
                ? i18n.actions.deleting
                : deleteConfirm
                  ? i18n.actions.confirm
                  : i18n.actions.delete}
            </Button>
          )}
          <Button
            className={`px-3 py-1 rounded text-xs bg-accent text-white hover:opacity-90 data-[disabled]:opacity-50 ${bounceButton}`}
            onPress={handleSave}
            isDisabled={!canSave || saveNoteMutation.isPending}
          >
            {saveNoteMutation.isPending ? i18n.actions.saving : i18n.actions.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
