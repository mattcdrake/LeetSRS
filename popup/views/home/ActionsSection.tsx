import { Button } from 'react-aria-components';
import type { IconType } from 'react-icons';
import { FaForwardFast, FaForwardStep, FaPause } from 'react-icons/fa6';
import { useTimedConfirmation } from '@/popup/hooks/useTimedConfirmation';
import { destructiveButton, secondaryButton } from '@/popup/styles';
import { useI18n } from '../../contexts/I18nContext';
import { ExpandableSection } from './ExpandableSection';

interface ActionsSectionProps {
  onDelete: () => void;
  onDelay: (days: number) => void;
  onPause: () => void;
  isDisabled: boolean;
}

interface ActionButtonProps {
  icon: IconType;
  label: string;
  onPress: () => void;
  isDisabled: boolean;
}

function ActionButton({ icon: Icon, label, onPress, isDisabled }: ActionButtonProps) {
  return (
    <Button
      className={`flex-1 flex flex-col items-center justify-center gap-1 ${secondaryButton}`}
      onPress={onPress}
      isDisabled={isDisabled}
    >
      <Icon aria-hidden="true" className="w-4 h-4" />
      <span>{label}</span>
    </Button>
  );
}

export function ActionsSection({ onDelete, onDelay, onPause, isDisabled }: ActionsSectionProps) {
  const t = useI18n();
  const { isConfirming, startOrConfirm } = useTimedConfirmation();

  return (
    <ExpandableSection title={t.actionsSection.title} isDisabled={isDisabled}>
      <div className="mt-3 space-y-3">
        <div className="flex gap-2">
          <ActionButton
            icon={FaForwardStep}
            label={t.actionsSection.delay1Day}
            onPress={() => onDelay(1)}
            isDisabled={isDisabled}
          />
          <ActionButton
            icon={FaForwardFast}
            label={t.actionsSection.delay5Days}
            onPress={() => onDelay(5)}
            isDisabled={isDisabled}
          />
          <ActionButton icon={FaPause} label={t.actions.pause} onPress={onPause} isDisabled={isDisabled} />
        </div>

        <div className="pt-3 border-t border-current flex justify-end">
          <Button
            className={destructiveButton(isConfirming)}
            onPress={() => startOrConfirm(onDelete)}
            isDisabled={isDisabled}
          >
            {isConfirming ? t.actions.confirmDelete : t.actionsSection.deleteCard}
          </Button>
        </div>
      </div>
    </ExpandableSection>
  );
}
