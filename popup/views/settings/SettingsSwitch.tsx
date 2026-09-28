import { type ReactNode, useId } from 'react';
import { buttonInteraction } from '@/popup/styles';
import { SettingsRow } from './SettingsGroup';

interface SettingsSwitchProps {
  label: string;
  hint?: ReactNode;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (isSelected: boolean) => void;
}

export function SettingsSwitch({ label, hint, isSelected, isDisabled = false, onChange }: SettingsSwitchProps) {
  const hintId = useId();
  return (
    <SettingsRow label={label} hint={hint} hintId={hintId}>
      <button
        type="button"
        role="switch"
        disabled={isDisabled}
        aria-checked={isSelected}
        aria-label={label}
        aria-describedby={hint ? hintId : undefined}
        onClick={() => onChange(!isSelected)}
        className={`relative inline-flex h-5 w-8 shrink-0 items-center rounded-full ${buttonInteraction} ${
          isSelected ? 'bg-accent' : 'bg-[var(--ls-switch-off)]'
        }`}
      >
        <span
          className={`size-4 rounded-full bg-[var(--ls-switch-thumb)] shadow-(--ls-shadow-thumb) transition-transform ${
            isSelected ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </SettingsRow>
  );
}
