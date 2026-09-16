import { useEffect, useRef } from 'react';
import { Button, Label, TextArea, TextField } from 'react-aria-components';
import { useI18n } from '@/popup/contexts/I18nContext';
import { useDraftUntilSaved } from '@/popup/hooks/useDraftUntilSaved';
import { useTimedConfirmation } from '@/popup/hooks/useTimedConfirmation';
import { useNoteQuery, useSaveNoteMutation } from '@/popup/queries/notes';
import { destructiveButton, secondaryButton } from '@/popup/styles';
import { NOTES_MAX_LENGTH } from '@/shared/models';

const MAX_TEXTAREA_HEIGHT = 160; // px, matches max-h-40

interface NoteEditorProps {
  frontendId: string;
  variant: 'regular' | 'compact';
  isDisabled?: boolean;
}

export function NoteEditor(props: NoteEditorProps) {
  return <CardNoteEditor key={props.frontendId} {...props} />;
}

function CardNoteEditor({ frontendId, variant, isDisabled = false }: NoteEditorProps) {
  const t = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCompact = variant === 'compact';

  const { isConfirming, startOrConfirm } = useTimedConfirmation();

  const { data: note, isLoading, error } = useNoteQuery(frontendId);
  const saveNoteMutation = useSaveNoteMutation(frontendId);

  const draft = useDraftUntilSaved(note ?? '');
  const { value: text, setValue: setText } = draft;

  const save = async () => {
    try {
      await saveNoteMutation.mutateAsync(text);
      draft.markSaved();
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const remove = () =>
    startOrConfirm(async () => {
      try {
        await saveNoteMutation.mutateAsync('');
        draft.discard();
      } catch (error) {
        console.error('Failed to delete note:', error);
      }
    });

  const originalText = note ?? '';
  const characterCount = text.length;
  const isOverLimit = characterCount > NOTES_MAX_LENGTH;
  const hasChanges = text !== originalText;

  const canSave = hasChanges && !isOverLimit && text.length > 0;
  const hasExistingNote = note != null;
  const deleteConfirm = isConfirming;
  const isPending = saveNoteMutation.isPending;
  const isDeleting = isPending && saveNoteMutation.variables === '';
  const isSaving = isPending && !isDeleting;
  const saveError = saveNoteMutation.error;

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
          className={`w-full p-3 rounded-lg border border-current bg-primary text-primary resize-none focus:outline-none focus:ring-1 focus:ring-accent ${isCompact ? 'mt-1.5 text-xs max-h-40 overflow-y-auto' : 'mt-3 text-sm'}`}
          placeholder={isLoading ? t.notes.placeholderLoading : t.notes.placeholderEmpty}
          rows={isCompact ? 1 : 4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isDisabled || isLoading || isPending}
        />
      </TextField>
      {saveError != null && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {t.notes.saveFailed}
        </p>
      )}
      <div className={`flex items-center justify-between ${isCompact ? 'mt-1.5' : 'mt-2'}`}>
        <span className={`text-xs ${isOverLimit ? 'text-danger' : 'text-secondary'}`}>
          {t.format.characterCount(characterCount, NOTES_MAX_LENGTH)}
        </span>
        <div className="flex gap-2">
          {hasExistingNote && (
            <Button className={destructiveButton(deleteConfirm)} onPress={remove} isDisabled={isDisabled || isPending}>
              {isDeleting ? t.actions.deleting : deleteConfirm ? t.actions.confirm : t.actions.delete}
            </Button>
          )}
          <Button className={secondaryButton} onPress={save} isDisabled={isDisabled || !canSave || isPending}>
            {isSaving ? t.actions.saving : t.actions.save}
          </Button>
        </div>
      </div>
    </>
  );
}
