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
  useExportDataMutation,
  useImportDataMutation,
  useResetAllDataMutation,
} from '@/hooks/useBackgroundQueries';
import {
  DEFAULT_MAX_NEW_CARDS_PER_DAY,
  MIN_NEW_CARDS_PER_DAY,
  MAX_NEW_CARDS_PER_DAY,
  DEFAULT_THEME,
} from '@/shared/settings';
import { useState, useEffect, useRef } from 'react';
import { APP_VERSION, FEEDBACK_FORM_URL } from '@/shared/config';

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
  const exportDataMutation = useExportDataMutation();
  const importDataMutation = useImportDataMutation();
  const resetAllDataMutation = useResetAllDataMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resetConfirmation, setResetConfirmation] = useState(false);

  const handleExport = async () => {
    try {
      const jsonData = await exportDataMutation.mutateAsync();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leetsrs-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      'Are you sure you want to import this data?\n\n' +
        'This will replace ALL your current data including cards, review history, and notes.'
    );

    if (!confirmed) {
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      const text = await file.text();
      await importDataMutation.mutateAsync(text);
      alert('Data imported successfully!');
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = async () => {
    if (!resetConfirmation) {
      setResetConfirmation(true);
      setTimeout(() => setResetConfirmation(false), 3000);
      return;
    }

    // Browser confirmation dialog
    const confirmed = window.confirm(
      'Are you absolutely sure you want to delete all data? This action cannot be undone.\n\n' +
        'All your cards, review history, statistics, and notes will be permanently deleted.'
    );

    if (!confirmed) {
      setResetConfirmation(false);
      return;
    }

    try {
      await resetAllDataMutation.mutateAsync();
      alert('All data has been reset');
      setResetConfirmation(false);
    } catch (error) {
      console.error('Reset failed:', error);
      alert('Failed to reset data');
    }
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">Data</h3>
      <div className="space-y-2">
        <Button
          onPress={handleExport}
          isDisabled={exportDataMutation.isPending}
          className={`w-full px-4 py-2 rounded transition-opacity hover:opacity-80 bg-tertiary text-primary ${bounceButton}`}
        >
          {exportDataMutation.isPending ? 'Exporting...' : 'Export Data'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
          id="import-file-input"
        />
        <Button
          onPress={() => fileInputRef.current?.click()}
          isDisabled={importDataMutation.isPending}
          className={`w-full px-4 py-2 rounded transition-opacity hover:opacity-80 bg-tertiary text-primary ${bounceButton}`}
        >
          {importDataMutation.isPending ? 'Importing...' : 'Import Data'}
        </Button>
        <Button
          onPress={handleReset}
          isDisabled={resetAllDataMutation.isPending}
          className={`w-full px-4 py-2 rounded transition-opacity hover:opacity-80 text-white bg-danger ${bounceButton}`}
        >
          {resetAllDataMutation.isPending
            ? 'Resetting...'
            : resetConfirmation
              ? 'Click again to confirm'
              : 'Reset All Data'}
        </Button>
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">About</h3>
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="text-tertiary">v{APP_VERSION}</span>
        <span className="text-tertiary">•</span>
        <span className="text-tertiary">© 2025 Matt Drake</span>
        <span className="text-tertiary">•</span>
        <a
          href="https://github.com/mtdrake/leetsrs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          GitHub
        </a>
      </div>
      <div className="mt-4 flex justify-center">
        <Button
          onPress={() => window.open(FEEDBACK_FORM_URL, '_blank')}
          className={`px-4 py-2 rounded transition-opacity hover:opacity-80 bg-accent text-white ${bounceButton}`}
        >
          Send Feedback
        </Button>
      </div>
    </div>
  );
}

export function SettingsView() {
  return (
    <ViewLayout title="Settings">
      <AppearanceSection />
      <ReviewSettingsSection />
      <DataSection />
      <AboutSection />
    </ViewLayout>
  );
}
