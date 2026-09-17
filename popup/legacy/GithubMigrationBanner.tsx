import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'react-aria-components';
import { FaGithub, FaXmark } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import { gistSyncQueryKeys, useGithubAuthQuery } from '@/popup/queries/gist-sync';
import { background } from '@/shared/background-service';

export function GithubMigrationBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data } = useGithubAuthQuery();
  const client = useQueryClient();
  const t = useI18n().settings.gistSync;
  const dismiss = useMutation({
    mutationFn: () => background.dismissMigrationNotice(),
    onSuccess: () => client.invalidateQueries({ queryKey: gistSyncQueryKeys.auth }),
  });

  if (!data?.migrationNotice) return null;

  return (
    <div className="flex items-start gap-2 border-b border-green-200 bg-green-100 px-4 py-2 text-xs leading-5 text-green-950">
      <FaGithub className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p>
          {t.migrationNotice}{' '}
          <Button
            className="cursor-pointer font-semibold underline underline-offset-2 focus-visible:outline-2"
            onPress={onOpenSettings}
          >
            {t.migrationOpenSettings}
          </Button>
        </p>
        {dismiss.isError && <p role="alert">{t.migrationDismissFailed}</p>}
      </div>
      <Button
        aria-label={t.migrationDismiss}
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-green-200 focus-visible:outline-2 disabled:opacity-50"
        isDisabled={dismiss.isPending}
        onPress={() => dismiss.mutate()}
      >
        <FaXmark aria-hidden="true" />
      </Button>
    </div>
  );
}
