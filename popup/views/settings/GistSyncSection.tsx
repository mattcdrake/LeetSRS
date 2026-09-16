import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { FaArrowsRotate, FaArrowUpRightFromSquare, FaCircleExclamation, FaCircleInfo, FaGithub } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import { GithubMigrationNotice } from '@/popup/legacy/GithubMigrationNotice';
import {
  gistSyncQueryKeys,
  useGistSyncConfigQuery,
  useGistSyncStatusQuery,
  useGithubAuthQuery,
  useSetGistSyncEnabledMutation,
  useSetupGistSyncMutation,
} from '@/popup/queries/gist-sync';
import { background } from '@/shared/background-service';
import { SettingsSwitch } from './SettingsSwitch';

const buttonClass =
  'min-h-10 px-3 py-2 rounded-lg border border-current bg-primary text-primary text-xs hover:bg-secondary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
export function GistSyncSection() {
  const translations = useI18n();
  const t = translations.settings.gistSync;
  const client = useQueryClient();
  const auth = useGithubAuthQuery();
  const { data: config } = useGistSyncConfigQuery();
  const { data: status } = useGistSyncStatusQuery();
  const destinations = useQuery({
    queryKey: [...gistSyncQueryKeys.all, 'destinations', auth.data?.account?.id],
    queryFn: () => background.listGistDestinations(),
    enabled: !!auth.data?.account && !auth.data.signingIn,
  });
  const setup = useSetupGistSyncMutation();
  const enable = useSetGistSyncEnabledMutation();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const action = useMutation({
    mutationFn: (action: 'signIn' | 'signOut') =>
      action === 'signIn' ? background.startGithubSignIn() : background.signOutGithub(),
    networkMode: 'always',
    onSuccess: () => client.invalidateQueries({ queryKey: gistSyncQueryKeys.all }),
  });
  const signingIn = !!auth.data?.signingIn || (action.isPending && action.variables === 'signIn');
  const busy = action.isPending || setup.isPending || enable.isPending || !!auth.data?.signingIn;
  const destination = selected ?? config?.gistId ?? destinations.data?.find((gist) => gist.suggested)?.id ?? '';
  const result = setup.data ?? enable.data;
  const save = () => {
    enable.reset();
    setup.mutate(destination === 'create' ? { mode: 'create' } : { mode: 'existing', gistId: destination }, {
      onSuccess: (result) => {
        if (result.saved) {
          setEditing(false);
          setSelected(null);
        }
      },
    });
  };
  const toggle = (enabled: boolean) => {
    setup.reset();
    enable.mutate(enabled);
  };
  return (
    <section className="mb-4 text-primary text-xs space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t.title}</h3>
        {auth.data?.account && (
          <TooltipTrigger delay={350} closeDelay={0}>
            <Button
              aria-label={t.syncInfo}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-secondary hover:bg-secondary cursor-help focus-visible:outline-2"
            >
              <FaCircleInfo className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Tooltip
              placement="bottom end"
              className="z-[1100] max-w-[280px] rounded-lg border border-current bg-primary p-3 text-xs leading-relaxed text-primary shadow-lg"
            >
              {t.syncDetails}
            </Tooltip>
          </TooltipTrigger>
        )}
      </div>
      <GithubMigrationNotice />
      {auth.data?.account ? (
        <>
          <p className="flex items-center gap-2 text-xs text-secondary">
            <FaGithub className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{auth.data.account.login}</span>
          </p>
          {config?.gistId && (
            <div className="space-y-1 text-xs">
              <SettingsSwitch
                icon={FaArrowsRotate}
                label={t.syncEnabled}
                isSelected={config.enabled}
                isDisabled={busy}
                onChange={toggle}
              />
              <p className="text-xs text-secondary">
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
          )}
          {config?.gistId && !editing ? (
            <div className="space-y-1 border-t border-current pt-4">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span>{t.destination}</span>
                <a
                  aria-label={t.openGist}
                  className="inline-flex items-center gap-1.5 text-xs text-accent"
                  href={`https://gist.github.com/${encodeURIComponent(config.gistId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.open} <FaArrowUpRightFromSquare className="h-2.5 w-2.5" aria-hidden="true" />
                </a>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span
                  className="min-w-0 truncate text-xs text-secondary"
                  title={destinations.data?.find((gist) => gist.id === config.gistId)?.description ?? config.gistId}
                >
                  {destinations.data?.find((gist) => gist.id === config.gistId)?.description ?? config.gistId}
                </span>
                <Button
                  className="shrink-0 rounded px-1 py-1 text-xs text-secondary hover:text-primary cursor-pointer focus-visible:outline-2"
                  isDisabled={busy}
                  onPress={() => {
                    setSelected(null);
                    setup.reset();
                    enable.reset();
                    setEditing(true);
                  }}
                >
                  {t.change}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs" htmlFor="gist-destination">
                {t.destination}
              </label>
              <select
                id="gist-destination"
                className="w-full min-h-10 px-3 py-2 rounded-lg border border-current bg-primary text-xs"
                value={destination}
                disabled={busy}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">{t.chooseBackup}</option>
                <option value="create">{t.createNewGist}</option>
                {destinations.data?.map((gist) => (
                  <option key={gist.id} value={gist.id}>
                    {gist.description} — {new Date(gist.updatedAt).toLocaleDateString()}
                    {gist.suggested ? ` (${t.previousBackup})` : ''}
                  </option>
                ))}
              </select>
              {destinations.isPending && <p role="status">{t.loadingBackups}</p>}
              {destinations.isError && (
                <p role="alert">
                  {t.loadBackupsFailed}{' '}
                  <Button className={buttonClass} onPress={() => void destinations.refetch()}>
                    {t.retry}
                  </Button>
                </p>
              )}
              <Button
                className={`${buttonClass} w-full font-medium`}
                isDisabled={busy || !destination}
                onPress={() => void save()}
              >
                {setup.isPending ? t.saving : config?.gistId ? t.save : t.connectAndSync}
              </Button>
              {config?.gistId && (
                <Button
                  className="w-full rounded-lg py-2 text-xs text-secondary hover:bg-secondary cursor-pointer focus-visible:outline-2 disabled:opacity-50"
                  isDisabled={busy}
                  onPress={() => {
                    setEditing(false);
                    setSelected(null);
                    setup.reset();
                  }}
                >
                  {t.cancel}
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {signingIn ? (
            <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-current bg-primary px-3">
              <span role="status" className="flex items-center gap-2.5 text-xs text-secondary">
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                {t.signingIn}
              </span>
              <Button
                className="rounded-lg px-2 py-2 text-xs font-medium text-secondary hover:text-primary cursor-pointer focus-visible:outline-2 disabled:opacity-50"
                isDisabled={action.isPending && action.variables === 'signOut'}
                onPress={() => action.mutate('signOut')}
              >
                {t.cancel}
              </Button>
            </div>
          ) : (
            <Button
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-current bg-primary px-3 py-2 text-xs text-primary cursor-pointer hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              isDisabled={busy || auth.isPending}
              onPress={() => action.mutate('signIn')}
            >
              <FaGithub className="h-4 w-4" aria-hidden="true" />
              {t.signIn}
            </Button>
          )}
        </div>
      )}
      {!signingIn && (auth.isError || action.isError || auth.data?.error) && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--current-danger)_8%,transparent)] p-3 text-xs leading-relaxed text-danger"
        >
          <FaCircleExclamation className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>{t.signInFailed}</p>
        </div>
      )}
      {(setup.isError || enable.isError) && <p role="alert">{t.saveFailed}</p>}
      {result && (
        <p role={result.saved ? 'status' : 'alert'}>
          {result.saved ? t.saved : `${t.saveFailed}: ${translations.syncNotices[result.error]}`}
        </p>
      )}
      {status?.lastError && (
        <p role="alert">
          {t.syncFailed}: {translations.syncNotices[status.lastError]}
        </p>
      )}
      {auth.data?.account && (
        <div className="border-t border-current pt-4 -mx-1">
          <Button
            className="rounded-lg px-2 py-2 text-xs font-medium text-secondary hover:bg-secondary hover:text-primary cursor-pointer focus-visible:outline-2 disabled:opacity-50"
            isDisabled={action.isPending}
            onPress={() => {
              setSelected(null);
              setup.reset();
              enable.reset();
              setEditing(false);
              action.mutate('signOut');
            }}
          >
            {t.signOut}
          </Button>
        </div>
      )}
    </section>
  );
}
