import { Switch } from 'react-aria-components';
import type { ReactNode } from 'react';

interface SettingsSwitchProps {
  label: string;
  isSelected: boolean;
  onChange: () => void;
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
      <Switch
        isSelected={isSelected}
        onChange={onChange}
        className={`group inline-flex touch-none items-center ${hasIcons ? 'gap-2' : ''}`}
      >
        {({ isSelected }) => (
          <>
            {leftIcon?.(isSelected)}
            <span
              className={`relative flex items-center h-6 w-11 cursor-pointer rounded-full transition-colors ${
                isSelected ? 'bg-accent' : 'bg-tertiary border border-current'
              } group-data-[focus-visible]:ring-2 ring-offset-2 ring-offset-primary`}
            >
              <span
                className={`block h-5 w-5 mx-0.5 rounded-full bg-white shadow-sm transition-all ${
                  isSelected ? 'translate-x-5' : ''
                } group-data-[pressed]:scale-95`}
              />
            </span>
            {rightIcon?.(isSelected)}
          </>
        )}
      </Switch>
    </div>
  );
}
