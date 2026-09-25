import { Button, Link, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { LuChevronDown, LuClock, LuNotebookPen, LuPause, LuTrash2, LuYoutube } from 'react-icons/lu';
import { Tooltip } from '@/popup/components/Tooltip';
import { useTimedConfirmation } from '@/popup/hooks/useTimedConfirmation';
import { buttonInteraction } from '@/popup/styles';
import { useI18n } from '../../contexts/I18nContext';

interface ActionsSectionProps {
  notesId: string;
  notesOpen: boolean;
  onToggleNotes: () => void;
  youtubeUrl?: string;
  onDelete: () => void;
  onDelay: (days: number) => void;
  onPause: () => void;
  isDisabled: boolean;
}

const textButton = `h-8 px-2 rounded-md flex items-center gap-1.5 duration-[120ms] ${buttonInteraction}`;
const iconButton = `size-8 rounded-md grid place-items-center text-tertiary duration-[120ms] hover:bg-secondary ${buttonInteraction}`;

export function ActionsSection({
  notesId,
  notesOpen,
  onToggleNotes,
  youtubeUrl,
  onDelete,
  onDelay,
  onPause,
  isDisabled,
}: ActionsSectionProps) {
  const t = useI18n();
  const { isConfirming, startOrConfirm } = useTimedConfirmation();
  const deleteLabel = isConfirming ? t.actions.confirmDelete : t.actionsSection.deleteCard;

  return (
    <div className="flex items-center gap-0.5 -mx-1.5 text-xs text-secondary">
      <Button
        className={`${textButton} ${notesOpen ? 'bg-secondary text-primary' : 'hover:bg-secondary'}`}
        aria-expanded={notesOpen}
        aria-controls={notesId}
        onPress={onToggleNotes}
        isDisabled={isDisabled}
      >
        <LuNotebookPen aria-hidden="true" className="size-3.5 shrink-0" />
        {t.notes.title}
      </Button>
      <MenuTrigger>
        <Button
          className={`${textButton} hover:bg-secondary data-[pressed]:bg-secondary`}
          aria-label={t.actionsSection.postpone}
          isDisabled={isDisabled}
        >
          <LuClock aria-hidden="true" className="size-3.5 shrink-0" />
          {t.actionsSection.postponeShort}
          <LuChevronDown aria-hidden="true" className="size-3 shrink-0 text-tertiary" />
        </Button>
        <Popover
          placement="bottom start"
          offset={4}
          className="z-[1100] min-w-32 rounded-lg border border-strong bg-surface p-1 shadow-card"
        >
          <Menu className="outline-none" onAction={(days) => onDelay(Number(days))}>
            {[1, 5].map((days) => (
              <MenuItem
                key={days}
                id={days}
                className="h-8 px-2 rounded-md flex items-center text-xs text-primary cursor-pointer outline-none data-[focused]:bg-secondary"
              >
                {days === 1 ? t.actionsSection.delay1Day : t.actionsSection.delay5Days}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </MenuTrigger>
      <span className="flex-1" />
      <Tooltip label={t.actionsSection.pauseCard}>
        <Button
          className={`${iconButton} hover:text-primary`}
          aria-label={t.actionsSection.pauseCard}
          onPress={onPause}
          isDisabled={isDisabled}
        >
          <LuPause aria-hidden="true" className="size-3.5" />
        </Button>
      </Tooltip>
      <Tooltip label={deleteLabel}>
        <Button
          className={
            isConfirming ? `${textButton} bg-danger text-white hover:opacity-90` : `${iconButton} hover:text-danger`
          }
          aria-label={deleteLabel}
          onPress={() => startOrConfirm(onDelete)}
          isDisabled={isDisabled}
        >
          <LuTrash2 aria-hidden="true" className="size-3.5 shrink-0" />
          {isConfirming && t.actions.confirm}
        </Button>
      </Tooltip>
      {youtubeUrl && (
        <Tooltip label={t.youtubeSolution}>
          <Link
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.youtubeSolution}
            className={`${iconButton} hover:text-primary`}
          >
            <LuYoutube aria-hidden="true" className="size-4" />
          </Link>
        </Tooltip>
      )}
    </div>
  );
}
