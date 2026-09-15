import { NoteEditor } from '@/popup/components/notes/NoteEditor';
import { useI18n } from '../../contexts/I18nContext';
import { ExpandableSection } from './ExpandableSection';

interface NotesSectionProps {
  frontendId: string;
  isDisabled?: boolean;
}

export function NotesSection({ frontendId, isDisabled = false }: NotesSectionProps) {
  const t = useI18n();
  return (
    <ExpandableSection title={t.notes.title} isDisabled={isDisabled}>
      <NoteEditor frontendId={frontendId} variant="regular" isDisabled={isDisabled} />
    </ExpandableSection>
  );
}
