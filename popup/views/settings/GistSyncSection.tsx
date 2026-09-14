import { useEffect, useRef, useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { FaArrowsRotate, FaCloudArrowDown, FaCloudArrowUp, FaGithub } from 'react-icons/fa6';
import {
  useGistSyncConfigQuery,
  useGistSyncStatusQuery,
  useSetGistSyncEnabledMutation,
  useSetupGistSyncMutation,
} from '@/popup/queries/gist-sync';
import { bounceButton } from '@/popup/styles';
import type { GistConnectionResult, GistSetup, GistSyncConfig } from '@/shared/models';
import { useI18n } from '../../contexts/I18nContext';
import { SettingsSwitch } from './SettingsSwitch';

const buttonClass = `px-3 py-2 rounded bg-accent text-white text-sm disabled:opacity-50 ${bounceButton}`;
const inputClass =
  'w-full px-2 py-1 rounded border bg-tertiary text-primary border-current text-sm disabled:opacity-50';

type GistDraft = { pat: string; gistId: string; mode: GistSetup['mode'] };
type GistView = { kind: 'unset' | 'viewing' | 'saved' } | { kind: 'editing'; draft: GistDraft };

function createEditingView(config: GistSyncConfig): GistView {
  return { kind: 'editing', draft: { pat: config.pat, gistId: config.gistId ?? '', mode: 'existing' } };
}

export function GistSyncSection() {
  const translations = useI18n();
  const t = translations.settings.gistSync;
  const configQuery = useGistSyncConfigQuery();
  const { data: config } = configQuery;
  const { data: status } = useGistSyncStatusQuery();
  const setup = useSetupGistSyncMutation();
  const enable = useSetGistSyncEnabledMutation();
  const [view, setView] = useState<GistView>({ kind: 'unset' });
  const [autoFocusSetup, setAutoFocusSetup] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const patInput = useRef<HTMLInputElement>(null);
  const wasEditing = useRef(false);
  const [outcome, setOutcome] = useState<{ error: boolean; text: string } | null>(null);
  const busy = setup.isPending || enable.isPending;
  const connected = !!config?.pat && !!config?.gistId;
  const editing = view.kind === 'editing';
  const inputs = editing ? view.draft : undefined;

  if (config && (view.kind === 'unset' || (view.kind === 'viewing' && !connected))) {
    setView(connected ? { kind: 'viewing' } : createEditingView(config));
  } else if (view.kind === 'saved' && connected) {
    setView({ kind: 'viewing' });
  }

  useEffect(() => {
    if (wasEditing.current && !editing && connected) {
      editButton.current?.focus();
      wasEditing.current = false;
    } else if (editing) wasEditing.current = true;
  }, [editing, connected]);

  function setDraft(draft: GistDraft) {
    setView({ kind: 'editing', draft });
  }

  function cancel() {
    if (!config) return;
    setView(connected ? { kind: 'viewing' } : createEditingView(config));
    setOutcome(null);
    setAutoFocusSetup(true);
    // The reset setup stays mounted, so restore focus directly.
    if (!connected) patInput.current?.focus();
  }

  function showConnectionResult(result: GistConnectionResult) {
    setOutcome(
      result.saved
        ? { error: false, text: t.saved }
        : { error: true, text: `${t.saveFailed}: ${translations.syncNotices[result.error]}` }
    );
  }

  async function save() {
    if (!inputs || busy) return;
    setOutcome(null);
    try {
      const result = await setup.mutateAsync(
        inputs.mode === 'create'
          ? { mode: 'create', pat: inputs.pat }
          : { mode: 'existing', pat: inputs.pat, gistId: inputs.gistId }
      );
      if (result.saved) setView({ kind: 'saved' });
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

  const isError = outcome ? outcome.error : !!status?.lastError;
  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <FaGithub />
        {t.title}
      </h3>
      {config && inputs && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          onReset={(event) => {
            event.preventDefault();
            cancel();
          }}
        >
          <TextField className="flex flex-col gap-1" isRequired isDisabled={busy}>
            <Label className="text-sm">{t.patLabel}</Label>
            <Input
              ref={patInput}
              autoFocus={connected || autoFocusSetup}
              type="password"
              value={inputs.pat}
              onChange={(event) => setDraft({ ...inputs, pat: event.target.value })}
              placeholder={t.patPlaceholder}
              className={inputClass}
            />
            <a
              href="https://github.com/settings/tokens/new?scopes=gist&description=LeetSRS"
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-xs text-accent hover:underline"
            >
              {t.patHelpLink}
            </a>
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
            {setup.isPending ? t.saving : t.save}
          </Button>
          <Button type="reset" isDisabled={busy} className={`ml-2 ${buttonClass}`}>
            {t.cancel}
          </Button>
        </form>
      )}
      {configQuery.isError && (
        <p role="alert" className="mt-3 text-sm text-red-700 [.dark_&]:text-red-400">
          {t.configFailed}
        </p>
      )}
      {config && connected && !editing && (
        <div className="space-y-4">
          <a
            href={`https://gist.github.com/${encodeURIComponent(config.gistId ?? '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-accent hover:underline break-all"
          >
            {t.openGist}
          </a>
          <SettingsSwitch
            label={t.syncEnabled}
            isSelected={config.enabled}
            isDisabled={busy}
            onChange={(value) => void toggle(value)}
          />
          <div className="text-xs text-secondary">
            <p>{t.latestEditNotice}</p>
            <details className="mt-1">
              <summary className="w-fit cursor-pointer text-accent hover:underline">{t.howSyncWorks}</summary>
              <p className="mt-1">{t.syncDetails}</p>
            </details>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-secondary">{t.lastSync}:</span>
            <span aria-live="polite" aria-atomic="true" className="flex items-center gap-1 text-right">
              {status?.syncInProgress ? (
                <>
                  <FaArrowsRotate className="animate-spin text-accent" />
                  {t.syncing}
                </>
              ) : (
                <>
                  {status?.lastSyncDirection === 'push' && <FaCloudArrowUp className="text-accent" />}
                  {status?.lastSyncDirection === 'pull' && <FaCloudArrowDown className="text-accent" />}
                  {status?.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString() : t.lastSyncNever}
                </>
              )}
            </span>
          </div>
          <Button
            ref={editButton}
            onPress={() => {
              setView(createEditingView(config));
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
          {outcome?.text ??
            (status?.lastError ? `${t.syncFailed}: ${translations.syncNotices[status.lastError]}` : null)}
        </p>
      )}
    </div>
  );
}
