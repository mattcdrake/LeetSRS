import { useRef } from 'react';
import { Button } from 'react-aria-components';
import { FaDownload, FaTrashCan, FaUpload } from 'react-icons/fa6';
import { useExportDataMutation, useImportDataMutation, useResetAllDataMutation } from '@/popup/queries/data';
import { useI18n } from '../../contexts/I18nContext';

export function DataSection() {
  const t = useI18n();
  const exportDataMutation = useExportDataMutation();
  const importDataMutation = useImportDataMutation();
  const resetAllDataMutation = useResetAllDataMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      alert(t.errors.failedToExportData);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(t.settings.data.importConfirmMessage);

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
      alert(t.settings.data.importSuccess);
    } catch (error) {
      console.error('Import failed:', error);
      alert(`${t.settings.data.importFailed} ${error instanceof Error ? error.message : t.errors.unknownError}`);
    }

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = async () => {
    if (!window.confirm(t.settings.data.resetConfirmMessage)) return;

    try {
      await resetAllDataMutation.mutateAsync();
      alert(t.settings.data.resetSuccess);
    } catch (error) {
      console.error('Reset failed:', error);
      alert(t.errors.failedToResetData);
    }
  };

  return (
    <section aria-labelledby="data-heading" className="mb-4 pt-4 border-t border-current text-primary">
      <h3 id="data-heading" className="text-sm font-medium mb-2">
        {t.settings.data.title}
      </h3>
      <p className="text-xs text-secondary leading-relaxed">{t.settings.data.description}</p>
      <div className="flex gap-2 mt-4 mb-4">
        <Button
          onPress={handleExport}
          isDisabled={exportDataMutation.isPending}
          className="flex flex-1 items-center justify-center gap-2 min-h-10 px-2 py-2 rounded-lg border border-current text-xs bg-primary hover:bg-secondary cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
        >
          <FaDownload aria-hidden="true" className="shrink-0" />
          {exportDataMutation.isPending ? t.settings.data.exporting : t.settings.data.exportData}
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
          className="flex flex-1 items-center justify-center gap-2 min-h-10 px-2 py-2 rounded-lg border border-current text-xs bg-primary hover:bg-secondary cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
        >
          <FaUpload aria-hidden="true" className="shrink-0" />
          {importDataMutation.isPending ? t.settings.data.importing : t.settings.data.importData}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-current pt-4">
        <div className="flex items-start gap-2">
          <FaTrashCan aria-hidden="true" className="w-4 h-4 shrink-0 text-secondary mt-0.5" />
          <div>
            <h4 className="text-xs font-medium">{t.settings.data.resetAllData}</h4>
            <p id="reset-description" className="mt-1 text-xs text-secondary leading-relaxed">
              {t.settings.data.resetDescription}
            </p>
          </div>
        </div>
        <Button
          aria-describedby="reset-description"
          onPress={handleReset}
          isDisabled={resetAllDataMutation.isPending}
          className="shrink-0 min-h-10 px-2 py-2 rounded-lg text-xs text-danger hover:bg-secondary cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
        >
          {resetAllDataMutation.isPending ? t.settings.data.resetting : t.settings.data.resetAction}
        </Button>
      </div>
    </section>
  );
}
