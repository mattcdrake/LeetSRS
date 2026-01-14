import { Switch } from 'react-aria-components';
import { FaSun, FaMoon } from 'react-icons/fa6';
import {
  useThemeQuery,
  useSetThemeMutation,
  useAnimationsEnabledQuery,
  useSetAnimationsEnabledMutation,
} from '@/hooks/useBackgroundQueries';
import { DEFAULT_THEME } from '@/shared/settings';
import { i18n } from '@/shared/i18n';

export function AppearanceSection() {
  const { data: theme = DEFAULT_THEME } = useThemeQuery();
  const setThemeMutation = useSetThemeMutation();
  const { data: animationsEnabled = true } = useAnimationsEnabledQuery();
  const setAnimationsEnabledMutation = useSetAnimationsEnabledMutation();

  const toggleTheme = () => {
    setThemeMutation.mutate(theme === 'light' ? 'dark' : 'light');
  };

  const toggleAnimations = () => {
    setAnimationsEnabledMutation.mutate(!animationsEnabled);
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">{i18n.settings.appearance.title}</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span>{i18n.settings.appearance.darkMode}</span>
          </div>
          <Switch
            isSelected={theme === 'dark'}
            onChange={toggleTheme}
            className="group inline-flex touch-none items-center gap-2"
          >
            {({ isSelected }) => (
              <>
                <FaSun
                  className={`text-sm transition-colors ${!isSelected ? 'text-accent' : 'text-tertiary opacity-50'}`}
                />
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
                <FaMoon
                  className={`text-sm transition-colors ${isSelected ? 'text-accent' : 'text-tertiary opacity-50'}`}
                />
              </>
            )}
          </Switch>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span>{i18n.settings.appearance.enableAnimations}</span>
          </div>
          <Switch
            isSelected={animationsEnabled}
            onChange={toggleAnimations}
            className="group inline-flex touch-none items-center"
          >
            {({ isSelected }) => (
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
            )}
          </Switch>
        </div>
      </div>
    </div>
  );
}
