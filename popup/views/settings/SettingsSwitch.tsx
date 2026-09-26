import type { ReactNode } from 'react';
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
  return (
    <SettingsRow label={label} hint={hint}>
      <button
        type="button"
        role="switch"
        disabled={isDisabled}
        aria-checked={isSelected}
        aria-label={label}
        onClick={() => onChange(!isSelected)}
        className={`relative inline-flex h-5 w-8 shrink-0 items-center rounded-full ${buttonInteraction} ${
          isSelected ? 'bg-accent' : 'bg-[var(--switch-off)]'
        }`}
      >
        <span
          className={`size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.3)] transition-transform ${
            isSelected ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </SettingsRow>
  );
}
