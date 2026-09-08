import { NoteEditor } from '@/entrypoints/popup/components/notes/NoteEditor';
import { useI18n } from '../../../contexts/I18nContext';

interface CardNotesProps {
  cardId: string;
}

export function CardNotes({ cardId }: CardNotesProps) {
  const t = useI18n();

  return (
    <div className="mt-3 pt-3 border-t border-current">
      <span className="text-xs text-secondary">{t.notes.title}</span>
      <NoteEditor cardId={cardId} variant="compact" />
    </div>
  );
}
