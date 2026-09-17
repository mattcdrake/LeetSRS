import { Button, Heading } from 'react-aria-components';
import { FaGithub, FaShieldHalved } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import type { PopupDialogContentProps } from '@/popup/dialogs/registry';

export function GithubMigrationNotice({ onDismiss, onOpenSettings }: PopupDialogContentProps) {
  const t = useI18n().settings.gistSync;
  return (
    <>
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
      <div className="mt-6 flex flex-col gap-2">
        <Button
          className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white cursor-pointer hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2"
          onPress={() => {
            onDismiss();
            onOpenSettings?.();
          }}
        >
          {onOpenSettings ? t.migrationOpenSettings : t.migrationContinue}
        </Button>
        {onOpenSettings && (
          <Button
            className="rounded-xl px-4 py-2 text-sm text-secondary cursor-pointer hover:bg-secondary focus-visible:outline-2"
            onPress={onDismiss}
          >
            {t.migrationLater}
          </Button>
        )}
      </div>
    </>
  );
}
