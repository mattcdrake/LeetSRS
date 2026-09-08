import { Button, Label, TextArea, TextField } from 'react-aria-components';
import { NOTES_MAX_LENGTH } from '@/domain/notes';
import { useI18n } from '@/entrypoints/popup/contexts/I18nContext';
import { bounceButton } from '@/entrypoints/popup/styles';
import { useNoteEditor } from './useNoteEditor';

interface NoteEditorProps {
  cardId: string;
  variant: 'regular' | 'compact';
}

export function NoteEditor({ cardId }: NoteEditorProps) {
  const t = useI18n();

  const {
    text,
    setText,
    save,
    remove,
    canSave,
    isOverLimit,
    characterCount,
    hasExistingNote,
    deleteConfirm,
    isLoading,
    isSaving,
    isDeleting,
    error,
  } = useNoteEditor(cardId);

  if (error) {
    console.error('Failed to load note:', error);
  }

  return (
    <>
      <TextField className="w-full">
        <Label className="sr-only">{t.notes.ariaLabel}</Label>
        <TextArea
          className="w-full mt-3 p-2 rounded border border-current bg-tertiary text-primary text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder={isLoading ? t.notes.placeholderLoading : t.notes.placeholderEmpty}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading || isSaving}
        />
      </TextField>
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs ${isOverLimit ? 'text-danger' : 'text-secondary'}`}>
          {t.format.characterCount(characterCount, NOTES_MAX_LENGTH)}
        </span>
        <div className="flex gap-2">
          {hasExistingNote && (
            <Button
              className={`px-4 py-1.5 rounded text-sm ${deleteConfirm ? 'bg-ultra-danger' : 'bg-danger'} text-white hover:opacity-90 data-[disabled]:opacity-50 ${bounceButton}`}
              onPress={remove}
              isDisabled={isDeleting}
            >
              {isDeleting ? t.actions.deleting : deleteConfirm ? t.actions.confirm : t.actions.delete}
            </Button>
          )}
          <Button
            className={`px-4 py-1.5 rounded text-sm bg-accent text-white hover:opacity-90 data-[disabled]:opacity-50 ${bounceButton}`}
            onPress={save}
            isDisabled={!canSave || isSaving}
          >
            {isSaving ? t.actions.saving : t.actions.save}
          </Button>
        </div>
      </div>
    </>
  );
}
