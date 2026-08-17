import type { ReactNode } from 'react';

interface SettingsSwitchProps {
  label: string;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
  leftIcon?: (isSelected: boolean) => ReactNode;
  rightIcon?: (isSelected: boolean) => ReactNode;
}

export function SettingsSwitch({ label, isSelected, onChange, leftIcon, rightIcon }: SettingsSwitchProps) {
  const hasIcons = leftIcon || rightIcon;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span>{label}</span>
      </div>
      <div className={`inline-flex items-center ${hasIcons ? 'gap-2' : ''}`}>
        {leftIcon?.(isSelected)}
        <button
          type="button"
          role="switch"
          aria-checked={isSelected}
          aria-label={label}
          onClick={() => onChange(!isSelected)}
          className={`group relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors focus-visible:ring-2 ring-offset-2 ring-offset-primary ${
            isSelected ? 'bg-accent' : 'bg-tertiary border border-current'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-all group-active:scale-95 ${
              isSelected ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
        {rightIcon?.(isSelected)}
      </div>
    </div>
  );
}
