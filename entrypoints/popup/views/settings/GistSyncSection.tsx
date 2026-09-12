import { useEffect, useRef, useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { FaArrowsRotate, FaCloudArrowDown, FaCloudArrowUp, FaGithub } from 'react-icons/fa6';
import type { GistConnectionResult, GistSetup, GistSyncConfig } from '@/domain/gist-sync';
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

const buttonClass = `px-3 py-2 rounded bg-accent text-white text-sm disabled:opacity-50 ${bounceButton}`;

export function GistSyncSection() {
  const t = useI18n().settings.gistSync;
  const configQuery = useGistSyncConfigQuery();
  const { data: config } = configQuery;
  const { data: status } = useGistSyncStatusQuery();
  const setup = useSetupGistSyncMutation();
  const enable = useSetGistSyncEnabledMutation();
  const sync = useTriggerGistSyncMutation();
  const [editing, setEditing] = useState<boolean | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [outcome, setOutcome] = useState<{ error: boolean; text: string } | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const busy = setup.isPending || enable.isPending || sync.isPending || !!status?.syncInProgress;
  const connected = !!config?.pat && !!config?.gistId;
  if (config && (editing === null || (!connected && !editing))) setEditing(!connected);

  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = !!editing;
  }, [editing]);

  function showConnectionResult(result: GistConnectionResult) {
    setOutcome(
      !result.saved
        ? { error: true, text: `${t.saveFailed}: ${result.error}` }
        : result.sync && !result.sync.success
          ? { error: true, text: `${t.savedSyncFailed}: ${result.sync.error}` }
          : { error: false, text: t.saved }
    );
  }

  async function save(input: GistSetup) {
    setOutcome(null);
    try {
      const result = await setup.mutateAsync(input);
      if (result.saved) setEditing(false);
      showConnectionResult(result);
      return result;
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
  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <FaGithub />
        {t.title}
      </h3>
      <p className="text-sm text-secondary mb-4">{t.description}</p>
      <p className="text-xs text-secondary mb-4">{t.connectionHelp}</p>
      {config && editing && (
        <GistSetupForm
          key={formKey}
          config={config}
          busy={busy}
          saving={setup.isPending}
          onSave={save}
          onCancel={() => {
            setEditing(false);
            setFormKey(formKey + 1);
            setOutcome(null);
          }}
        />
      )}
      {configQuery.isError && (
        <p role="alert" className="mt-3 text-sm text-red-700 [.dark_&]:text-red-400">
          {t.configFailed}
        </p>
      )}
      {connected && !editing && (
        <div className="space-y-4">
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
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-secondary">{t.lastSync}:</span>
            <span className="flex items-center gap-1 text-right">
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
          <Button
            ref={editButton}
            onPress={() => {
              setEditing(true);
              setOutcome(null);
            }}
            isDisabled={busy}
            className={`w-full ${buttonClass}`}
          >
            {t.edit}
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

function GistSetupForm({
  config,
  busy,
  saving,
  onSave,
  onCancel,
}: {
  config: GistSyncConfig;
  busy: boolean;
  saving: boolean;
  onSave: (input: GistSetup) => Promise<GistConnectionResult | undefined>;
  onCancel: () => void;
}) {
  const t = useI18n().settings.gistSync;
  const [inputs, setDraft] = useState<{ pat: string; gistId: string; mode: GistSetup['mode'] }>(() => ({
    pat: config.pat,
    gistId: config.gistId ?? '',
    mode: 'existing',
  }));
  const inputClass =
    'w-full px-2 py-1 rounded border bg-tertiary text-primary border-current text-sm disabled:opacity-50';

  async function submit() {
    const result = await onSave(
      inputs.mode === 'create'
        ? { mode: 'create', pat: inputs.pat }
        : { mode: 'existing', pat: inputs.pat, gistId: inputs.gistId }
    );
    if (result && !result.saved && result.createdGistId) {
      setDraft({ ...inputs, mode: 'existing', gistId: result.createdGistId });
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) void submit();
      }}
    >
      <TextField className="flex flex-col gap-1" isRequired isDisabled={busy}>
        <Label className="text-sm">{t.patLabel}</Label>
        <Input
          autoFocus
          type="password"
          value={inputs.pat}
          onChange={(event) => setDraft({ ...inputs, pat: event.target.value })}
          placeholder={t.patPlaceholder}
          className={inputClass}
        />
        <div className="text-xs text-secondary">
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
      <fieldset disabled={busy} className="space-y-2 text-sm disabled:opacity-50">
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
        <TextField className="flex flex-col gap-1" isRequired isDisabled={busy}>
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
        isDisabled={busy || !inputs.pat.trim() || (inputs.mode === 'existing' && !inputs.gistId.trim())}
        className={buttonClass}
      >
        {saving ? t.saving : t.save}
      </Button>
      <Button onPress={onCancel} isDisabled={busy} className={`ml-2 ${buttonClass}`}>
        {t.cancel}
      </Button>
    </form>
  );
}
