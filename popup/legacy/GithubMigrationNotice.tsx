import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { FaGithub, FaShieldHalved } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import { gistSyncQueryKeys, useGithubAuthQuery } from '@/popup/queries/gist-sync';
import { background } from '@/shared/background-service';

export function GithubMigrationNotice({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { data } = useGithubAuthQuery();
  const client = useQueryClient();
  const t = useI18n().settings.gistSync;
  const dismiss = useMutation({
    mutationFn: async (openSettings: boolean) => {
      await background.dismissMigrationNotice();
      return openSettings;
    },
    onSuccess: (openSettings) => {
      client.setQueryData(gistSyncQueryKeys.auth, { ...data, migrationNotice: false });
      if (openSettings) onOpenSettings?.();
    },
  });
  return (
    <ModalOverlay
      isOpen={Boolean(data?.migrationNotice)}
      isDismissable={!dismiss.isPending}
      onOpenChange={(open) => {
        if (!open) dismiss.mutate(false);
      }}
      className="fixed inset-x-0 top-0 bottom-14 z-50 bg-black/40 backdrop-blur-sm"
    >
      <Modal className="absolute top-1/2 left-1/2 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-current bg-primary text-primary shadow-2xl">
        <Dialog className="p-6 outline-none">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <FaGithub className="h-6 w-6" aria-hidden="true" />
            </div>
            <Heading slot="title" className="text-xl font-semibold tracking-tight">
              {t.migrationTitle}
            </Heading>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-secondary">{t.migrationNotice}</p>
          <div className="mt-4 flex items-center gap-2 text-sm leading-relaxed text-primary">
            <FaShieldHalved className="shrink-0 text-brand" aria-hidden="true" />
            <span>{t.migrationDataSafe}</span>
          </div>
          {dismiss.isError && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {t.migrationDismissFailed}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button
              className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white cursor-pointer hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
              isDisabled={dismiss.isPending}
              onPress={() => dismiss.mutate(Boolean(onOpenSettings))}
            >
              {onOpenSettings ? t.migrationOpenSettings : t.migrationContinue}
            </Button>
            {onOpenSettings && (
              <Button
                className="rounded-xl px-4 py-2 text-sm text-secondary cursor-pointer hover:bg-secondary focus-visible:outline-2 disabled:opacity-50"
                isDisabled={dismiss.isPending}
                onPress={() => dismiss.mutate(false)}
              >
                {t.migrationLater}
              </Button>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
