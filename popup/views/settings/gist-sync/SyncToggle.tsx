import { FaArrowsRotate } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import type { GistSyncStatus } from '@/shared/gist-sync';
import { SettingsSwitch } from '../SettingsSwitch';

interface SyncToggleProps {
  enabled: boolean;
  status: GistSyncStatus | undefined;
  isDisabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function SyncToggle({ enabled, status, isDisabled, onChange }: SyncToggleProps) {
  const t = useI18n().settings.gistSync;
  return (
    <div className="text-xs">
      <SettingsSwitch
        icon={FaArrowsRotate}
        label={t.syncEnabled}
        isSelected={enabled}
        isDisabled={isDisabled}
        onChange={onChange}
      />
      <p className="-mt-1 pl-6 text-[11px] leading-4 text-secondary">
        {t.lastSync}:{' '}
        {status?.syncInProgress
          ? t.syncing
          : status?.lastSyncTime
            ? new Date(status.lastSyncTime).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : t.lastSyncNever}
      </p>
    </div>
  );
}
