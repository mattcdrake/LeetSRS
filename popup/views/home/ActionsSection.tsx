import { Button } from 'react-aria-components';
import { FaPause, FaRegClock, FaTrashCan } from 'react-icons/fa6';
import { useTimedConfirmation } from '@/popup/hooks/useTimedConfirmation';
import { buttonInteraction } from '@/popup/styles';
import { YouTubeLink } from '@/shared/ui/YouTubeLink';
import { useI18n } from '../../contexts/I18nContext';

interface ActionsSectionProps {
  youtubeUrl?: string;
  onDelete: () => void;
  onDelay: (days: number) => void;
  onPause: () => void;
  isDisabled: boolean;
}

export function ActionsSection({ youtubeUrl, onDelete, onDelay, onPause, isDisabled }: ActionsSectionProps) {
  const t = useI18n();
  const { isConfirming, startOrConfirm } = useTimedConfirmation();
  const actionClass = `flex flex-1 items-center justify-center gap-2 min-h-10 px-2 py-2 rounded-lg border border-current text-xs font-medium ${buttonInteraction}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 min-h-9 py-1 text-xs">
        <span className="flex items-center gap-2.5">
          <FaRegClock aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-secondary" />
          {t.actionsSection.postpone}
        </span>
        <fieldset
          aria-label={t.actionsSection.postpone}
          className="inline-flex shrink-0 rounded-lg border border-current"
        >
          {[1, 5].map((days) => (
            <Button
              key={days}
              className={`min-h-8 px-3 py-1.5 first:rounded-l-lg last:rounded-r-lg last:border-l border-current hover:bg-secondary ${buttonInteraction}`}
              onPress={() => onDelay(days)}
              isDisabled={isDisabled}
            >
              {days === 1 ? t.actionsSection.delay1Day : t.actionsSection.delay5Days}
            </Button>
          ))}
        </fieldset>
      </div>
      <div className="flex items-stretch gap-2">
        <Button
          className={`${actionClass} hover:bg-secondary`}
          aria-label={t.actionsSection.pauseCard}
          onPress={onPause}
          isDisabled={isDisabled}
        >
          <FaPause aria-hidden="true" className="size-3.5 shrink-0 text-secondary" />
          {t.actions.pause}
        </Button>
        <Button
          className={`${actionClass} ${isConfirming ? 'bg-danger text-white hover:opacity-90' : 'text-danger hover:bg-secondary'}`}
          aria-label={isConfirming ? t.actions.confirmDelete : t.actionsSection.deleteCard}
          onPress={() => startOrConfirm(onDelete)}
          isDisabled={isDisabled}
        >
          <FaTrashCan aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
          {isConfirming ? t.actions.confirm : t.actions.delete}
        </Button>
        <YouTubeLink
          url={youtubeUrl}
          label={t.youtubeSolution}
          className={`size-10 rounded-lg border border-current hover:bg-secondary ${buttonInteraction}`}
        />
      </div>
    </div>
  );
}
