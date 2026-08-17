import { useEffect, useRef } from 'react';
import { Button, TextField, TextArea, Label } from 'react-aria-components';
import { useNoteEditor } from '@/hooks/useNoteEditor';
import { NOTES_MAX_LENGTH } from '@/shared/notes';
import { bounceButton } from '@/shared/styles';
import { useI18n } from '../../../contexts/I18nContext';

const MAX_TEXTAREA_HEIGHT = 160; // px, matches max-h-40

interface CardNotesProps {
  cardId: string;
}

export function CardNotes({ cardId }: CardNotesProps) {
  const t = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  } = useNoteEditor(cardId);

  // Adjust height when note text changes (including initial load), scrolling past the cap
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    }
  }, [text]);

  return (
    <div className="mt-3 pt-3 border-t border-current">
      <span className="text-xs text-secondary">{t.notes.title}</span>
      <TextField className="w-full">
        <Label className="sr-only">{t.notes.ariaLabel}</Label>
        <TextArea
          ref={textareaRef}
          className="w-full mt-1.5 p-2 rounded border border-current bg-tertiary text-primary text-xs resize-none focus:outline-none focus:ring-1 focus:ring-accent max-h-40 overflow-y-auto"
          placeholder={isLoading ? t.notes.placeholderLoading : t.notes.placeholderEmpty}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading || isSaving}
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
              onPress={remove}
              isDisabled={isDeleting}
            >
              {isDeleting ? t.actions.deleting : deleteConfirm ? t.actions.confirm : t.actions.delete}
            </Button>
          )}
          <Button
            className={`px-3 py-1 rounded text-xs bg-accent text-white hover:opacity-90 data-[disabled]:opacity-50 ${bounceButton}`}
            onPress={save}
            isDisabled={!canSave || isSaving}
          >
            {isSaving ? t.actions.saving : t.actions.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
