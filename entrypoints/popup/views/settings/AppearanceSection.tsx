import { FaMoon, FaSun } from 'react-icons/fa6';
import { useSettingsQuery, useUpdateSettingsMutation } from '@/hooks/useBackgroundQueries';
import { useI18n } from '../../contexts/I18nContext';
import { SettingsSwitch } from './SettingsSwitch';

export function AppearanceSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();

  if (!settings) return null;

  const setDarkMode = (isSelected: boolean) => {
    updateSettingsMutation.mutate({ theme: isSelected ? 'dark' : 'light' });
  };

  const setAnimationsEnabled = (isSelected: boolean) => {
    updateSettingsMutation.mutate({ animationsEnabled: isSelected });
  };

  const setBadgeEnabled = (isSelected: boolean) => {
    updateSettingsMutation.mutate({ badgeEnabled: isSelected });
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">{t.settings.appearance.title}</h3>
      <div className="space-y-4">
        <SettingsSwitch
          label={t.settings.appearance.darkMode}
          isSelected={settings.theme === 'dark'}
          onChange={setDarkMode}
          leftIcon={(isSelected) => (
            <FaSun
              className={`text-sm transition-colors ${!isSelected ? 'text-accent' : 'text-tertiary opacity-50'}`}
            />
          )}
          rightIcon={(isSelected) => (
            <FaMoon
              className={`text-sm transition-colors ${isSelected ? 'text-accent' : 'text-tertiary opacity-50'}`}
            />
          )}
        />
        <SettingsSwitch
          label={t.settings.appearance.enableAnimations}
          isSelected={settings.animationsEnabled}
          onChange={setAnimationsEnabled}
        />
        <SettingsSwitch
          label={t.settings.appearance.showBadge}
          isSelected={settings.badgeEnabled}
          onChange={setBadgeEnabled}
        />
      </div>
    </div>
  );
}
