import { FaSun, FaMoon } from 'react-icons/fa6';
import {
  useThemeQuery,
  useSetThemeMutation,
  useAnimationsEnabledQuery,
  useSetAnimationsEnabledMutation,
  useBadgeEnabledQuery,
  useSetBadgeEnabledMutation,
} from '@/hooks/useBackgroundQueries';
import { DEFAULT_THEME, DEFAULT_BADGE_ENABLED } from '@/shared/settings';
import { i18n } from '@/shared/i18n';
import { SettingsSwitch } from './SettingsSwitch';

export function AppearanceSection() {
  const { data: theme = DEFAULT_THEME } = useThemeQuery();
  const setThemeMutation = useSetThemeMutation();
  const { data: animationsEnabled = true } = useAnimationsEnabledQuery();
  const setAnimationsEnabledMutation = useSetAnimationsEnabledMutation();
  const { data: badgeEnabled = DEFAULT_BADGE_ENABLED } = useBadgeEnabledQuery();
  const setBadgeEnabledMutation = useSetBadgeEnabledMutation();

  const toggleTheme = () => {
    setThemeMutation.mutate(theme === 'light' ? 'dark' : 'light');
  };

  const toggleAnimations = () => {
    setAnimationsEnabledMutation.mutate(!animationsEnabled);
  };

  const toggleBadge = () => {
    setBadgeEnabledMutation.mutate(!badgeEnabled);
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">{i18n.settings.appearance.title}</h3>
      <div className="space-y-4">
        <SettingsSwitch
          label={i18n.settings.appearance.darkMode}
          isSelected={theme === 'dark'}
          onChange={toggleTheme}
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
          label={i18n.settings.appearance.enableAnimations}
          isSelected={animationsEnabled}
          onChange={toggleAnimations}
        />
        <SettingsSwitch label={i18n.settings.appearance.showBadge} isSelected={badgeEnabled} onChange={toggleBadge} />
      </div>
    </div>
  );
}
