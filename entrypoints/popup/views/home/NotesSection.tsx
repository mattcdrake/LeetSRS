import { useState } from 'react';
import { Button } from 'react-aria-components';
import { NoteEditor } from '@/entrypoints/popup/components/notes/NoteEditor';
import { useI18n } from '../../contexts/I18nContext';

interface NotesSectionProps {
  cardId: string;
}

export function NotesSection({ cardId }: NotesSectionProps) {
  const t = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);

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

      <div className="px-4 pb-4 border-t border-current" hidden={!isExpanded}>
        <NoteEditor cardId={cardId} variant="regular" />
      </div>
    </div>
  );
}
