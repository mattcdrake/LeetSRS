import { useState, useEffect } from 'react';
import { Button, TextArea, TextField, Label } from 'react-aria-components';
import { useNoteQuery, useSaveNoteMutation, useDeleteNoteMutation } from '@/hooks/useBackgroundQueries';
import { NOTES_MAX_LENGTH } from '@/shared/notes';
import { bounceButton } from '@/shared/styles';

interface NotesSectionProps {
  cardId: string;
}

export function NotesSection({ cardId }: NotesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: note, isLoading, error } = useNoteQuery(cardId);
  const saveNoteMutation = useSaveNoteMutation(cardId);
  const deleteNoteMutation = useDeleteNoteMutation(cardId);

  // Sync fetched note with local state
  useEffect(() => {
    const text = note?.text || '';
    setNoteText(text);
    setDeleteConfirm(false);
  }, [note]);

  const handleSave = async () => {
    try {
      await saveNoteMutation.mutateAsync(noteText);
    } catch (error) {
      console.error('Failed to save note:', error);
      // Revert to original text on error
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

  if (error) {
    console.error('Failed to load note:', error);
  }

  return (
    <div className="border border-current rounded-lg bg-secondary overflow-hidden">
      <Button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-tertiary transition-colors"
        onPress={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-semibold text-primary">Notes</span>
        <span className={`text-xs text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </Button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-current">
          <TextField className="w-full">
            <Label className="sr-only">Note text</Label>
            <TextArea
              className="w-full mt-3 p-2 rounded border border-current bg-tertiary text-primary text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder={isLoading ? 'Loading...' : 'Add your notes here...'}
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              disabled={isLoading || saveNoteMutation.isPending}
              maxLength={NOTES_MAX_LENGTH + 100} // Allow typing over limit to show error
            />
          </TextField>
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-xs ${isOverLimit ? 'text-danger' : 'text-secondary'}`}>
              {characterCount}/{NOTES_MAX_LENGTH}
            </span>
            <div className="flex gap-2">
              {hasExistingNote && (
                <Button
                  className={`px-4 py-1.5 rounded text-sm ${deleteConfirm ? 'bg-ultra-danger' : 'bg-danger'} text-white hover:opacity-90 data-[disabled]:opacity-50 ${bounceButton}`}
                  onPress={handleDelete}
                  isDisabled={deleteNoteMutation.isPending}
                >
                  {deleteNoteMutation.isPending ? 'Deleting...' : deleteConfirm ? 'Confirm?' : 'Delete'}
                </Button>
              )}
              <Button
                className={`px-4 py-1.5 rounded text-sm bg-accent text-white hover:opacity-90 data-[disabled]:opacity-50 ${bounceButton}`}
                onPress={handleSave}
                isDisabled={!canSave || saveNoteMutation.isPending}
              >
                {saveNoteMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
