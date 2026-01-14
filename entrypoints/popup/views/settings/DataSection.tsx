import { Button } from 'react-aria-components';
import { bounceButton } from '@/shared/styles';
import { useExportDataMutation, useImportDataMutation, useResetAllDataMutation } from '@/hooks/useBackgroundQueries';
import { useState, useRef } from 'react';
import { i18n } from '@/shared/i18n';

export function DataSection() {
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
      alert(i18n.errors.failedToExportData);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(i18n.settings.data.importConfirmMessage);

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
      alert(i18n.settings.data.importSuccess);
    } catch (error) {
      console.error('Import failed:', error);
      alert(`${i18n.settings.data.importFailed} ${error instanceof Error ? error.message : i18n.errors.unknownError}`);
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
    const confirmed = window.confirm(i18n.settings.data.resetConfirmMessage);

    if (!confirmed) {
      setResetConfirmation(false);
      return;
    }

    try {
      await resetAllDataMutation.mutateAsync();
      alert(i18n.settings.data.resetSuccess);
      setResetConfirmation(false);
    } catch (error) {
      console.error('Reset failed:', error);
      alert(i18n.errors.failedToResetData);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">{i18n.settings.data.title}</h3>
      <div className="space-y-2">
        <Button
          onPress={handleExport}
          isDisabled={exportDataMutation.isPending}
          className={`w-full px-4 py-2 rounded transition-opacity hover:opacity-80 bg-tertiary text-primary ${bounceButton}`}
        >
          {exportDataMutation.isPending ? i18n.settings.data.exporting : i18n.settings.data.exportData}
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
          {importDataMutation.isPending ? i18n.settings.data.importing : i18n.settings.data.importData}
        </Button>
        <Button
          onPress={handleReset}
          isDisabled={resetAllDataMutation.isPending}
          className={`w-full px-4 py-2 rounded transition-opacity hover:opacity-80 text-white bg-danger ${bounceButton}`}
        >
          {resetAllDataMutation.isPending
            ? i18n.settings.data.resetting
            : resetConfirmation
              ? i18n.settings.data.clickToConfirm
              : i18n.settings.data.resetAllData}
        </Button>
      </div>
    </div>
  );
}
