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
    <SettingsSwitch
      label={t.syncEnabled}
      hint={<SyncStatusLine status={status} />}
      isSelected={enabled}
      isDisabled={isDisabled}
      onChange={onChange}
    />
  );
}

function SyncStatusLine({ status }: { status: GistSyncStatus | undefined }) {
  const t = useI18n().settings.gistSync;
  const lastSync = status?.lastSyncTime ? new Date(status.lastSyncTime) : null;
  const when = lastSync && t.syncTime(lastSync, lastSync.toDateString() === new Date().toDateString());
  let marker = null;
  let text = t.notSynced;
  if (status?.syncInProgress) {
    marker = (
      <span
        aria-hidden="true"
        className="inline-block size-2.5 shrink-0 animate-spin rounded-full border-[1.5px] border-[var(--current-text-tertiary)] border-t-transparent"
      />
    );
    text = t.syncing;
  } else if (status?.lastError) {
    marker = <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full bg-danger" />;
    if (when) text = t.lastSyncedAt(when);
  } else if (when) {
    marker = <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full bg-accent" />;
    text = t.syncedAt(when);
  }
  return (
    <span role="status" className="flex items-center gap-1.5">
      {marker}
      {text}
    </span>
  );
}
