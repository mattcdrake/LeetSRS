import { useState } from 'react';
import { Button, TextArea, TextField, Label } from 'react-aria-components';
import { useNoteEditor } from '@/hooks/useNoteEditor';
import { NOTES_MAX_LENGTH } from '@/shared/notes';
import { bounceButton } from '@/shared/styles';
import { useI18n } from '../../contexts/I18nContext';

interface NotesSectionProps {
  cardId: string;
}

export function NotesSection({ cardId }: NotesSectionProps) {
  const t = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);

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
    <div className="border border-current rounded-lg bg-secondary overflow-hidden">
      <Button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-tertiary transition-colors"
        onPress={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-semibold text-primary">{t.notes.title}</span>
        <span className={`text-xs text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </Button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-current">
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
        </div>
      )}
    </div>
  );
}
