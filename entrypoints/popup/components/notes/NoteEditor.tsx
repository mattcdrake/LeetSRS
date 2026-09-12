import { useEffect, useRef } from 'react';
import { Button, Label, TextArea, TextField } from 'react-aria-components';
import { NOTES_MAX_LENGTH } from '@/domain/cards';
import { useI18n } from '@/entrypoints/popup/contexts/I18nContext';
import { bounceButton } from '@/entrypoints/popup/styles';
import { useNoteEditor } from './useNoteEditor';

const MAX_TEXTAREA_HEIGHT = 160; // px, matches max-h-40

interface NoteEditorProps {
  slug: string;
  variant: 'regular' | 'compact';
}

export function NoteEditor({ slug, variant }: NoteEditorProps) {
  const t = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCompact = variant === 'compact';
  const buttonSizing = isCompact ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm';

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
  } = useNoteEditor(slug);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (!isCompact) {
      textarea.style.height = '';
    } else if (textarea.value === text) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    }
  }, [text, isCompact]);

  if (error) {
    console.error('Failed to load note:', error);
  }

  return (
    <>
      <TextField className="w-full">
        <Label className="sr-only">{t.notes.ariaLabel}</Label>
        <TextArea
          ref={textareaRef}
          className={`w-full p-2 rounded border border-current bg-tertiary text-primary resize-none focus:outline-none focus:ring-1 focus:ring-accent ${isCompact ? 'mt-1.5 text-xs max-h-40 overflow-y-auto' : 'mt-3 text-sm'}`}
          placeholder={isLoading ? t.notes.placeholderLoading : t.notes.placeholderEmpty}
          rows={isCompact ? 1 : 4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading || isSaving}
        />
      </TextField>
      <div className={`flex items-center justify-between ${isCompact ? 'mt-1.5' : 'mt-2'}`}>
        <span className={`text-xs ${isOverLimit ? 'text-danger' : 'text-secondary'}`}>
          {t.format.characterCount(characterCount, NOTES_MAX_LENGTH)}
        </span>
        <div className="flex gap-2">
          {hasExistingNote && (
            <Button
              className={`${buttonSizing} rounded ${deleteConfirm ? 'bg-ultra-danger' : 'bg-danger'} text-white hover:opacity-90 data-[disabled]:opacity-50 ${bounceButton}`}
              onPress={remove}
              isDisabled={isDeleting}
            >
              {isDeleting ? t.actions.deleting : deleteConfirm ? t.actions.confirm : t.actions.delete}
            </Button>
          )}
          <Button
            className={`${buttonSizing} rounded bg-accent text-white hover:opacity-90 data-[disabled]:opacity-50 ${bounceButton}`}
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
