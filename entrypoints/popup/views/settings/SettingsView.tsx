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
import { APP_VERSION } from '@/shared/config';

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
      a.download = `leetreps-backup-${new Date().toISOString().split('T')[0]}.json`;
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

function VersionInfo() {
  return (
    <div className="text-center text-sm text-tertiary">
      <p>Version {APP_VERSION}</p>
    </div>
  );
}

export function SettingsView() {
  return (
    <ViewLayout title="Settings">
      <AppearanceSection />
      <ReviewSettingsSection />
      <DataSection />
      <VersionInfo />
    </ViewLayout>
  );
}
