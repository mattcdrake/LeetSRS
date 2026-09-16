import type { IconType } from 'react-icons';

interface SettingsSwitchProps {
  label: string;
  icon?: IconType;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (isSelected: boolean) => void;
}

export function SettingsSwitch({ label, icon: Icon, isSelected, isDisabled = false, onChange }: SettingsSwitchProps) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon aria-hidden="true" className="w-4 h-4 shrink-0 text-secondary" />}
        <span>{label}</span>
      </div>
      <div className="inline-flex shrink-0 items-center">
        <button
          type="button"
          role="switch"
          disabled={isDisabled}
          aria-checked={isSelected}
          aria-label={label}
          onClick={() => onChange(!isSelected)}
          className={`group relative inline-flex h-6 w-11 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 items-center rounded-full transition-colors focus-visible:ring-2 ring-offset-2 ring-offset-primary ${
            isSelected ? 'bg-accent' : 'bg-tertiary border border-current'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-all group-active:scale-95 ${
              isSelected ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
