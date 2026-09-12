import { useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { FaArrowsRotate, FaCloudArrowDown, FaCloudArrowUp, FaGithub } from 'react-icons/fa6';
import type { GistConnectionResult, GistSetup } from '@/domain/gist-sync';
import {
  useGistSyncConfigQuery,
  useGistSyncStatusQuery,
  useSetGistSyncEnabledMutation,
  useSetupGistSyncMutation,
  useTriggerGistSyncMutation,
} from '@/entrypoints/popup/queries/gist-sync';
import { bounceButton } from '@/entrypoints/popup/styles';
import { useI18n } from '../../contexts/I18nContext';
import { SettingsSwitch } from './SettingsSwitch';

export function GistSyncSection() {
  const t = useI18n().settings.gistSync;
  const configQuery = useGistSyncConfigQuery();
  const { data: config } = configQuery;
  const { data: status } = useGistSyncStatusQuery();
  const setup = useSetupGistSyncMutation();
  const enable = useSetGistSyncEnabledMutation();
  const sync = useTriggerGistSyncMutation();
  const [draft, setDraft] = useState<{ pat: string; gistId: string; mode: GistSetup['mode'] } | null>(null);
  const [outcome, setOutcome] = useState<{ error: boolean; text: string } | null>(null);
  const inputs = draft ?? { pat: config?.pat ?? '', gistId: config?.gistId ?? '', mode: 'existing' };
  const busy = setup.isPending || enable.isPending || sync.isPending || !!status?.syncInProgress;
  const connected = !!config?.pat && !!config?.gistId;

  function showConnectionResult(result: GistConnectionResult) {
    setOutcome(
      !result.saved
        ? { error: true, text: `${t.saveFailed}: ${result.error}` }
        : result.sync && !result.sync.success
          ? { error: true, text: `${t.savedSyncFailed}: ${result.sync.error}` }
          : { error: false, text: t.saved }
    );
  }

  async function save() {
    setOutcome(null);
    try {
      const result = await setup.mutateAsync(
        inputs.mode === 'create'
          ? { mode: 'create', pat: inputs.pat }
          : { mode: 'existing', pat: inputs.pat, gistId: inputs.gistId }
      );
      if (result.saved) setDraft(null);
      else if (result.createdGistId) setDraft({ ...inputs, mode: 'existing', gistId: result.createdGistId });
      showConnectionResult(result);
    } catch {
      setOutcome({ error: true, text: t.saveFailed });
    }
  }

  async function toggle(enabled: boolean) {
    setOutcome(null);
    try {
      showConnectionResult(await enable.mutateAsync(enabled));
    } catch {
      setOutcome({ error: true, text: t.saveFailed });
    }
  }

  async function syncNow() {
    setOutcome(null);
    try {
      const result = await sync.mutateAsync();
      setOutcome(
        result.success ? { error: false, text: t.synced } : { error: true, text: `${t.syncFailed}: ${result.error}` }
      );
    } catch {
      setOutcome({ error: true, text: t.syncFailed });
    }
  }

  const isError = outcome ? outcome.error : !!status?.lastError;
  const inputClass =
    'w-full px-2 py-1 rounded border bg-tertiary text-primary border-current text-sm disabled:opacity-50';
  const buttonClass = `px-3 py-2 rounded bg-accent text-white text-sm disabled:opacity-50 ${bounceButton}`;
  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <FaGithub />
        {t.title}
      </h3>
      <p className="text-sm text-tertiary mb-4">{t.description}</p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && config) void save();
        }}
      >
        <TextField className="flex flex-col gap-1" isRequired isDisabled={busy || !config}>
          <Label className="text-sm">{t.patLabel}</Label>
          <Input
            type="password"
            value={inputs.pat}
            onChange={(event) => setDraft({ ...inputs, pat: event.target.value })}
            placeholder={t.patPlaceholder}
            className={inputClass}
          />
          <div className="text-xs text-tertiary">
            {t.patHelpText}{' '}
            <a
              href="https://github.com/settings/tokens/new?scopes=gist&description=LeetSRS"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {t.patHelpLink}
            </a>
          </div>
        </TextField>
        <fieldset disabled={busy || !config} className="space-y-2 text-sm disabled:opacity-50">
          <legend className="mb-1">{t.destination}</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="gist-mode"
              value="existing"
              checked={inputs.mode === 'existing'}
              onChange={() => setDraft({ ...inputs, mode: 'existing' })}
            />
            {t.existingGist}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="gist-mode"
              value="create"
              checked={inputs.mode === 'create'}
              onChange={() => setDraft({ ...inputs, mode: 'create' })}
            />
            {t.createNewGist}
          </label>
        </fieldset>
        {inputs.mode === 'existing' && (
          <TextField className="flex flex-col gap-1" isRequired isDisabled={busy || !config}>
            <Label className="text-sm">{t.gistIdLabel}</Label>
            <Input
              value={inputs.gistId}
              onChange={(event) => setDraft({ ...inputs, gistId: event.target.value })}
              placeholder={t.gistIdPlaceholder}
              className={inputClass}
            />
          </TextField>
        )}
        <Button
          type="submit"
          isDisabled={busy || !config || !inputs.pat.trim() || (inputs.mode === 'existing' && !inputs.gistId.trim())}
          className={buttonClass}
        >
          {setup.isPending ? t.saving : t.save}
        </Button>
      </form>
      {configQuery.isError && (
        <p role="alert" className="mt-3 text-sm text-red-700 [.dark_&]:text-red-400">
          {t.configFailed}
        </p>
      )}
      {connected && (
        <div className="space-y-4 mt-4 pt-4 border-t border-tertiary">
          <a
            href={`https://gist.github.com/${encodeURIComponent(config.gistId ?? '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-accent hover:underline break-all"
          >
            {t.destination}: {config.gistId}
          </a>
          <SettingsSwitch
            label={t.enableSync}
            isSelected={config.enabled}
            isDisabled={busy}
            onChange={(value) => void toggle(value)}
          />
          <div className="flex items-center justify-between text-sm">
            <span className="text-tertiary">{t.lastSync}:</span>
            <span className="flex items-center gap-1">
              {status?.lastSyncDirection === 'push' && <FaCloudArrowUp className="text-accent" />}
              {status?.lastSyncDirection === 'pull' && <FaCloudArrowDown className="text-accent" />}
              {status?.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString() : t.lastSyncNever}
            </span>
          </div>
          <Button
            onPress={() => void syncNow()}
            isDisabled={busy}
            className={`w-full flex items-center justify-center gap-2 ${buttonClass}`}
          >
            <FaArrowsRotate className={sync.isPending ? 'animate-spin' : ''} />
            {sync.isPending ? t.syncing : t.syncNow}
          </Button>
        </div>
      )}
      {(outcome || status?.lastError) && (
        <p
          role={isError ? 'alert' : 'status'}
          className={`mt-3 text-sm break-words ${isError ? 'text-red-700 [.dark_&]:text-red-400' : 'text-primary'}`}
        >
          {outcome?.text ?? `${t.syncFailed}: ${status?.lastError}`}
        </p>
      )}
    </div>
  );
}
