import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'react-aria-components';
import { LuInfo } from 'react-icons/lu';
import { Notice } from '@/popup/components/Notice';
import { Tooltip } from '@/popup/components/Tooltip';
import { useI18n } from '@/popup/contexts/I18nContext';
import {
  gistSyncQueryKeys,
  useGistSyncConfigQuery,
  useGistSyncStatusQuery,
  useGithubAuthQuery,
} from '@/popup/queries/gist-sync';
import { useGithubPermissions } from '@/popup/queries/github-permissions';
import { buttonInteraction, compactOutlineButton } from '@/popup/styles';
import { background } from '@/shared/background-service';
import type { GistConnectionResult, GistSetup } from '@/shared/gist-sync';
import { AccountRow } from './gist-sync/AccountRow';
import { DestinationPicker } from './gist-sync/DestinationPicker';
import { SignedOut } from './gist-sync/SignedOut';
import { SyncToggle } from './gist-sync/SyncToggle';
import { rowDividers, SettingsSection, settingsCard } from './SettingsGroup';

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
  const connectionNotice = (key: string, { isError, data }: { isError: boolean; data?: GistConnectionResult }) => {
    if (isError) return <Notice key={key} tone="danger" title={t.saveFailed} />;
    if (!data) return null;
    return data.saved ? (
      <Notice key={key} tone="success" title={t.saved} />
    ) : (
      <Notice key={key} tone="danger" title={t.saveFailed} body={translations.syncNotices[data.error]} />
    );
  };
  // Toggling and saving share one feedback line, so starting either clears the other's result.
  const clearFeedback = () => {
    toggleSync.reset();
    setup.reset();
  };

  const notices = [
    account && !permissions.isLoading && permissions.granted !== true && (
      <Notice
        key="permission-required"
        tone="warning"
        title={t.permissionRequired}
        action={
          <Button
            className={compactOutlineButton}
            isDisabled={permissions.request.isPending}
            onPress={() => permissions.enable(false)}
          >
            {t.enableAccess}
          </Button>
        }
      />
    ),
    (permissions.error || permissions.request.isError) && (
      <Notice key="permission-failed" tone="danger" title={t.permissionFailed} />
    ),
    !signingIn && (auth.isError || signOut.isError || auth.data?.error) && (
      <Notice key="sign-in-failed" tone="danger" title={t.signInFailed} />
    ),
    status?.lastError && (
      <Notice key="sync-failed" tone="danger" title={t.syncFailed} body={translations.syncNotices[status.lastError]} />
    ),
    connectionNotice('toggle', toggleSync),
    connectionNotice('setup', setup),
  ].filter(Boolean);

  return (
    <SettingsSection
      id="sync-heading"
      title={translations.settings.groups.sync}
      trailing={
        account && (
          <Tooltip label={t.syncDetails}>
            <Button
              className={`mb-1 inline-flex h-6 items-center gap-1 rounded-md px-1 text-xs text-tertiary hover:text-primary cursor-help ${buttonInteraction}`}
            >
              <LuInfo className="size-3.5" aria-hidden="true" />
              {t.syncInfo}
            </Button>
          </Tooltip>
        )
      }
    >
      {account ? (
        <div className={settingsCard}>
          {notices.length > 0 && <div className="mx-1.5 mt-1.5 space-y-1.5">{notices}</div>}
          <div className={rowDividers}>
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
          </div>
        </div>
      ) : (
        <SignedOut
          signingIn={signingIn}
          highlight={highlightSignIn}
          notices={notices.length > 0 && notices}
          isCancelDisabled={signOut.isPending || permissions.request.isPending}
          isSignInDisabled={signOut.isPending || permissions.request.isPending || auth.isPending}
          onSignIn={() => permissions.enable(true)}
          onCancel={() => signOut.mutate()}
        />
      )}
    </SettingsSection>
  );
}
