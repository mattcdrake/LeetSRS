import { useState } from 'react';
import { Button } from 'react-aria-components';
import type { IconType } from 'react-icons';
import { FaForwardFast, FaForwardStep, FaPause } from 'react-icons/fa6';
import { useTimedConfirmation } from '@/hooks/useTimedConfirmation';
import { bounceButton } from '@/shared/styles';
import { useI18n } from '../../contexts/I18nContext';

interface ActionsSectionProps {
  onDelete: () => void;
  onDelay: (days: number) => void;
  onPause: () => void;
}

interface ActionButtonProps {
  icon: IconType;
  label: string;
  onPress: () => void;
}

function ActionButton({ icon: Icon, label, onPress }: ActionButtonProps) {
  return (
    <Button
      className={`flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded text-sm bg-tertiary text-primary hover:bg-quaternary transition-colors ${bounceButton}`}
      onPress={onPress}
    >
      <Icon className="text-lg" />
      <span>{label}</span>
    </Button>
  );
}

export function ActionsSection({ onDelete, onDelay, onPause }: ActionsSectionProps) {
  const t = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const { isConfirming, startOrConfirm } = useTimedConfirmation();

  return (
    <div className="border border-current rounded-lg bg-secondary overflow-hidden">
      <Button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-tertiary transition-colors"
        onPress={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-semibold text-primary">{t.actionsSection.title}</span>
        <span className={`text-xs text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </Button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-current">
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <ActionButton icon={FaForwardStep} label={t.actionsSection.delay1Day} onPress={() => onDelay(1)} />
              <ActionButton icon={FaForwardFast} label={t.actionsSection.delay5Days} onPress={() => onDelay(5)} />
              <ActionButton icon={FaPause} label={t.actions.pause} onPress={onPause} />
            </div>

            <div className="pt-2 border-t border-current">
              <Button
                className={`w-full px-4 py-2 rounded text-sm ${
                  isConfirming ? 'bg-ultra-danger' : 'bg-danger'
                } text-white hover:opacity-90 transition-colors ${bounceButton}`}
                onPress={() => startOrConfirm(onDelete)}
              >
                {isConfirming ? t.actions.confirmDelete : t.actionsSection.deleteCard}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
