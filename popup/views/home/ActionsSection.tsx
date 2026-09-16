import { Button } from 'react-aria-components';
import { FaPause, FaRegClock, FaTrashCan } from 'react-icons/fa6';
import { useTimedConfirmation } from '@/popup/hooks/useTimedConfirmation';
import { buttonInteraction } from '@/popup/styles';
import { useI18n } from '../../contexts/I18nContext';
import { ExpandableSection } from './ExpandableSection';

interface ActionsSectionProps {
  onDelete: () => void;
  onDelay: (days: number) => void;
  onPause: () => void;
  isDisabled: boolean;
}

export function ActionsSection({ onDelete, onDelay, onPause, isDisabled }: ActionsSectionProps) {
  const t = useI18n();
  const { isConfirming, startOrConfirm } = useTimedConfirmation();
  const rowClass = `flex w-full items-center gap-2.5 min-h-9 px-2 py-2 rounded-lg text-xs text-left ${buttonInteraction}`;

  return (
    <ExpandableSection title={t.actionsSection.title} isDisabled={isDisabled}>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 min-h-9 px-2 py-1 text-xs">
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
        <Button className={`${rowClass} hover:bg-secondary`} onPress={onPause} isDisabled={isDisabled}>
          <FaPause aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-secondary" />
          {t.actionsSection.pauseCard}
        </Button>
        <div className="border-t border-current pt-1">
          <Button
            className={`${rowClass} ${isConfirming ? 'bg-danger text-white hover:opacity-90' : 'text-danger hover:bg-secondary'}`}
            onPress={() => startOrConfirm(onDelete)}
            isDisabled={isDisabled}
          >
            <FaTrashCan aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
            {isConfirming ? t.actions.confirmDelete : t.actionsSection.deleteCard}
          </Button>
        </div>
      </div>
    </ExpandableSection>
  );
}
