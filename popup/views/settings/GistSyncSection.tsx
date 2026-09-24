import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { FaCircleExclamation, FaCircleInfo } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import {
  gistSyncQueryKeys,
  useGistSyncConfigQuery,
  useGistSyncStatusQuery,
  useGithubAuthQuery,
} from '@/popup/queries/gist-sync';
import { useGithubPermissions } from '@/popup/queries/github-permissions';
import { secondaryButton } from '@/popup/styles';
import { background } from '@/shared/background-service';
import type { GistConnectionResult, GistSetup } from '@/shared/gist-sync';
import { AccountRow } from './gist-sync/AccountRow';
import { DestinationPicker } from './gist-sync/DestinationPicker';
import { SignedOut } from './gist-sync/SignedOut';
import { SyncToggle } from './gist-sync/SyncToggle';

function useGistSyncMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    networkMode: 'always',
    onSuccess: () => client.invalidateQueries({ queryKey: gistSyncQueryKeys.all }),
  });
}

export function GistSyncSection({
  highlightSignIn = false,
  highlightSetup = false,
}: {
  highlightSignIn?: boolean;
  highlightSetup?: boolean;
}) {
  const translations = useI18n();
  const t = translations.settings.gistSync;
  const auth = useGithubAuthQuery();
  const permissions = useGithubPermissions();
  const { data: config } = useGistSyncConfigQuery();
  const { data: status } = useGistSyncStatusQuery();
  const signOut = useGistSyncMutation(() => background.signOutGithub());
  const toggleSync = useGistSyncMutation((enabled: boolean) => background.setGistSyncEnabled(enabled));
  const setup = useGistSyncMutation((change: GistSetup) => background.setupGistSync(change));
  const account = auth.data?.account;
  const signingIn =
    !!auth.data?.signingIn || (permissions.request.isPending && !!permissions.request.variables?.intent);
  const busy =
    signOut.isPending ||
    permissions.request.isPending ||
    permissions.granted !== true ||
    toggleSync.isPending ||
    setup.isPending ||
    !!auth.data?.signingIn;
  // Toggling and saving share one feedback line, so starting either clears the other's result.
  const clearFeedback = () => {
    toggleSync.reset();
    setup.reset();
  };

  return (
    <section className="mb-3 text-primary text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t.title}</h3>
        {account && (
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
      {account && !permissions.isLoading && permissions.granted !== true && (
        <div role="alert" className="space-y-2">
          <p>{t.permissionRequired}</p>
          <Button
            className={secondaryButton}
            isDisabled={permissions.request.isPending}
            onPress={() => permissions.enable(false)}
          >
            {t.enableAccess}
          </Button>
        </div>
      )}
      {(permissions.error || permissions.request.isError) && <p role="alert">{t.permissionFailed}</p>}
      {account ? (
        <>
          <AccountRow
            login={account.login}
            isSigningOut={signOut.isPending}
            onSignOut={() => {
              clearFeedback();
              signOut.mutate();
            }}
          />
          {config?.gistId && (
            <SyncToggle
              enabled={config.enabled}
              status={status}
              isDisabled={busy}
              onChange={(enabled) => {
                clearFeedback();
                toggleSync.mutate(enabled);
              }}
            />
          )}
          <DestinationPicker
            accountId={account.id}
            gistId={config?.gistId}
            canListDestinations={permissions.granted === true && !auth.data?.signingIn}
            isDisabled={busy}
            isSaving={setup.isPending}
            highlight={highlightSetup}
            onSave={(change, options) => {
              clearFeedback();
              setup.mutate(change, options);
            }}
            onClearFeedback={clearFeedback}
          />
        </>
      ) : (
        <SignedOut
          signingIn={signingIn}
          highlight={highlightSignIn}
          isCancelDisabled={signOut.isPending || permissions.request.isPending}
          isSignInDisabled={signOut.isPending || permissions.request.isPending || auth.isPending}
          onSignIn={() => permissions.enable(true)}
          onCancel={() => signOut.mutate()}
        />
      )}
      {!signingIn && (auth.isError || signOut.isError || auth.data?.error) && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--current-danger)_8%,transparent)] p-3 text-xs leading-relaxed text-danger"
        >
          <FaCircleExclamation className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>{t.signInFailed}</p>
        </div>
      )}
      <ConnectionFeedback isError={toggleSync.isError} result={toggleSync.data} />
      <ConnectionFeedback isError={setup.isError} result={setup.data} />
      {status?.lastError && (
        <p role="alert">
          {t.syncFailed}: {translations.syncNotices[status.lastError]}
        </p>
      )}
    </section>
  );
}

function ConnectionFeedback({ isError, result }: { isError: boolean; result: GistConnectionResult | undefined }) {
  const translations = useI18n();
  const t = translations.settings.gistSync;
  if (isError) return <p role="alert">{t.saveFailed}</p>;
  if (!result) return null;
  return (
    <p role={result.saved ? 'status' : 'alert'}>
      {result.saved ? t.saved : `${t.saveFailed}: ${translations.syncNotices[result.error]}`}
    </p>
  );
}
