import { useState } from 'react';
import { useFocusWithin } from 'react-aria';
import { Button, Label, TextArea, TextField } from 'react-aria-components';
import { useI18n } from '@/popup/contexts/I18nContext';
import { useDraftUntilSaved } from '@/popup/hooks/useDraftUntilSaved';
import { useTimedConfirmation } from '@/popup/hooks/useTimedConfirmation';
import { useNoteQuery, useSaveNoteMutation } from '@/popup/queries/notes';
import { buttonInteraction } from '@/popup/styles';
import { NOTES_MAX_LENGTH } from '@/shared/learning-document';

const noteButton = `h-7 px-2.5 rounded-md text-xs duration-[120ms] ${buttonInteraction}`;

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
  const isCompact = variant === 'compact';

  const { isConfirming, startOrConfirm } = useTimedConfirmation();
  const [hasFocus, setHasFocus] = useState(false);
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setHasFocus });

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

  if (error) {
    console.error('Failed to load note:', error);
  }

  const isFooterVisible =
    !isCompact || hasFocus || hasChanges || saveError != null || isOverLimit || deleteConfirm || isPending;

  const fieldClassName = isCompact
    ? `bg-secondary outline-none placeholder:text-tertiary ${isOverLimit ? 'ring-2 ring-[var(--current-danger)]' : 'focus:ring-2 focus:ring-[var(--current-accent)]'}`
    : `border bg-primary focus:outline-none focus:ring-2 ${isOverLimit ? 'border-[var(--current-danger)] focus:ring-[color-mix(in_srgb,var(--current-danger)_20%,transparent)]' : 'border-current focus:border-[var(--current-accent)] focus:ring-[var(--current-accent-soft)]'}`;

  return (
    // Tracks focus across the field and its buttons so pressing a button does not hide the footer.
    <div {...focusWithinProps}>
      <TextField className="w-full">
        <Label className="sr-only">{t.notes.ariaLabel}</Label>
        <TextArea
          className={`w-full px-3 py-2 rounded-lg text-primary resize-none field-sizing-content min-h-9 max-h-40 overflow-y-auto text-xs leading-[18px] ${fieldClassName}`}
          placeholder={
            isLoading ? t.notes.placeholderLoading : isCompact ? t.notes.placeholderShort : t.notes.placeholderEmpty
          }
          rows={1}
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
      {isFooterVisible && (
        <div className={`flex items-center justify-between ${isCompact ? 'mt-1.5' : 'mt-2'}`}>
          <span className={`text-[11px] tabular-nums ${isOverLimit ? 'text-danger' : 'text-tertiary'}`}>
            {t.format.characterCount(characterCount, NOTES_MAX_LENGTH)}
          </span>
          <div className="flex gap-1">
            {hasExistingNote && (
              <Button
                className={`${noteButton} ${deleteConfirm ? 'bg-danger text-white hover:opacity-90' : 'text-secondary hover:bg-secondary hover:text-danger'}`}
                onPress={remove}
                isDisabled={isDisabled || isPending}
              >
                {isDeleting ? t.actions.deleting : deleteConfirm ? t.actions.confirm : t.actions.delete}
              </Button>
            )}
            <Button
              className={`${noteButton} bg-accent text-[var(--current-on-accent)] font-medium hover:opacity-90`}
              onPress={save}
              isDisabled={isDisabled || !canSave || isPending}
            >
              {isSaving ? t.actions.saving : t.actions.save}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
