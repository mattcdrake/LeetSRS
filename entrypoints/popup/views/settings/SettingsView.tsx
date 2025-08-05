import { Button, TextField, Label, Input, Switch } from 'react-aria-components';
import { FaSun, FaMoon } from 'react-icons/fa6';
import { ViewLayout } from '../../components/ViewLayout';
import { bounceButton } from '@/shared/styles';
import {
  useMaxNewCardsPerDayQuery,
  useSetMaxNewCardsPerDayMutation,
  useAnimationsEnabledQuery,
  useSetAnimationsEnabledMutation,
  useThemeQuery,
  useSetThemeMutation,
} from '@/hooks/useBackgroundQueries';
import {
  DEFAULT_MAX_NEW_CARDS_PER_DAY,
  MIN_NEW_CARDS_PER_DAY,
  MAX_NEW_CARDS_PER_DAY,
  DEFAULT_THEME,
} from '@/shared/settings';
import { useState, useEffect } from 'react';

function AppearanceSection() {
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
      <h3 className="text-lg font-semibold mb-4">Appearance</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span>Dark mode</span>
            <span className="text-xs text-secondary">Easier on the eyes at night</span>
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
            <span>Enable animations</span>
            <span className="text-xs text-secondary">Smooth transitions and effects</span>
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

function ReviewSettingsSection() {
  const { data: maxNewCardsPerDay } = useMaxNewCardsPerDayQuery();
  const setMaxNewCardsPerDayMutation = useSetMaxNewCardsPerDayMutation();
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (maxNewCardsPerDay !== undefined) {
      setInputValue(maxNewCardsPerDay.toString());
    }
  }, [maxNewCardsPerDay]);

  const handleBlur = () => {
    const value = parseInt(inputValue, 10);
    if (!isNaN(value) && value >= MIN_NEW_CARDS_PER_DAY && value <= MAX_NEW_CARDS_PER_DAY) {
      setMaxNewCardsPerDayMutation.mutate(value);
    } else {
      // Reset to current value on invalid input
      setInputValue((maxNewCardsPerDay ?? DEFAULT_MAX_NEW_CARDS_PER_DAY).toString());
    }
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">Review Settings</h3>
      <div className="space-y-3">
        <TextField className="flex items-center justify-between">
          <Label>New Cards Per Day</Label>
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            min={MIN_NEW_CARDS_PER_DAY.toString()}
            max={MAX_NEW_CARDS_PER_DAY.toString()}
            placeholder={DEFAULT_MAX_NEW_CARDS_PER_DAY.toString()}
            className="w-20 px-2 py-1 rounded border bg-tertiary text-primary border-current"
          />
        </TextField>
      </div>
    </div>
  );
}

function DataSection() {
  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">Data</h3>
      <div className="space-y-2">
        <Button
          className={`w-full px-4 py-2 rounded transition-opacity hover:opacity-80 bg-tertiary text-primary ${bounceButton}`}
        >
          Export Data
        </Button>
        <Button
          className={`w-full px-4 py-2 rounded transition-opacity hover:opacity-80 bg-tertiary text-primary ${bounceButton}`}
        >
          Import Data
        </Button>
        <Button
          className={`w-full px-4 py-2 rounded transition-opacity hover:opacity-80 text-white bg-danger ${bounceButton}`}
        >
          Reset All Data
        </Button>
      </div>
    </div>
  );
}

function VersionInfo() {
  return (
    <div className="text-center text-sm text-tertiary">
      <p>Version 0.1.0</p>
    </div>
  );
}

export function SettingsView() {
  return (
    <ViewLayout>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Settings</h1>
        </div>

        <AppearanceSection />
        <ReviewSettingsSection />
        <DataSection />
        <VersionInfo />
      </div>
    </ViewLayout>
  );
}
