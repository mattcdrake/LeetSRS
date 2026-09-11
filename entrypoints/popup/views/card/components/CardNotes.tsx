import { NoteEditor } from '@/entrypoints/popup/components/notes/NoteEditor';
import { useI18n } from '../../../contexts/I18nContext';

interface CardNotesProps {
  slug: string;
}

export function CardNotes({ slug }: CardNotesProps) {
  const t = useI18n();

  return (
    <div className="mt-3 pt-3 border-t border-current">
      <span className="text-xs text-secondary">{t.notes.title}</span>
      <NoteEditor slug={slug} variant="compact" />
    </div>
  );
}
