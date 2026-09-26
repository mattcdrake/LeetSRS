import { useMutation } from '@tanstack/react-query';
import { useId, useRef } from 'react';
import { Button } from 'react-aria-components';
import type { IconType } from 'react-icons';
import { LuDownload, LuUpload } from 'react-icons/lu';
import { buttonInteraction } from '@/popup/styles';
import { background } from '@/shared/background-service';
import { readLearningDocument } from '@/shared/learning-document';
import { useI18n } from '../../contexts/I18nContext';
import { RowText, SettingsCard, SettingsRow, SettingsSection, settingsRow } from './SettingsGroup';

export function DataSection() {
  const t = useI18n();
  const exportDataMutation = useMutation({
    mutationFn: async () => JSON.stringify(await readLearningDocument(), null, 2),
  });
  const importDataMutation = useMutation({
    mutationFn: (jsonData: string) => background.importData(jsonData),
  });
  const resetAllDataMutation = useMutation({
    mutationFn: () => background.resetAllData(),
  });
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
    <SettingsSection id="data-heading" title={t.settings.data.title}>
      <SettingsCard>
        <DataAction
          label={exportDataMutation.isPending ? t.settings.data.exporting : t.settings.data.exportData}
          hint={t.settings.data.exportHint}
          Icon={LuDownload}
          isDisabled={exportDataMutation.isPending}
          onPress={handleExport}
        />
        <DataAction
          label={importDataMutation.isPending ? t.settings.data.importing : t.settings.data.importData}
          hint={t.settings.data.importHint}
          Icon={LuUpload}
          isDisabled={importDataMutation.isPending}
          onPress={() => fileInputRef.current?.click()}
        />
      </SettingsCard>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
        id="import-file-input"
      />
      <SettingsCard className="mt-2">
        <SettingsRow
          label={t.settings.data.resetAllData}
          hint={t.settings.data.resetDescription}
          hintId="reset-description"
        >
          <Button
            aria-describedby="reset-description"
            onPress={handleReset}
            isDisabled={resetAllDataMutation.isPending}
            className={`h-7 shrink-0 rounded-md px-2 text-xs font-medium text-danger duration-[120ms] hover:bg-[var(--danger-soft)] ${buttonInteraction}`}
          >
            {resetAllDataMutation.isPending ? t.settings.data.resetting : t.settings.data.resetAction}
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}

interface DataActionProps {
  label: string;
  hint: string;
  Icon: IconType;
  isDisabled: boolean;
  onPress: () => void;
}

function DataAction({ label, hint, Icon, isDisabled, onPress }: DataActionProps) {
  const id = useId();
  return (
    // The hint describes the button instead of joining its name.
    <Button
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-hint`}
      isDisabled={isDisabled}
      onPress={onPress}
      className={`${settingsRow} w-[calc(100%-1.75rem)] rounded-sm text-left ${buttonInteraction}`}
    >
      <RowText label={<span id={`${id}-label`}>{label}</span>} hint={hint} hintId={`${id}-hint`} />
      <Icon aria-hidden="true" className="size-4 shrink-0 text-tertiary" />
    </Button>
  );
}
