import { Button, Heading } from 'react-aria-components';
import { useI18n } from '@/popup/contexts/I18nContext';
import type { PopupDialogContentProps } from './registry';

export function ReleaseAnnouncement({ onDismiss }: PopupDialogContentProps) {
  const t = useI18n().releaseAnnouncement;
  return (
    <>
      <Heading slot="title" className="text-xl font-semibold tracking-tight">
        {t.title}
      </Heading>
      <p className="mt-5 text-sm leading-relaxed text-secondary">{t.placeholder}</p>
      <Button
        className="mt-6 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white cursor-pointer hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2"
        onPress={onDismiss}
      >
        {t.dismiss}
      </Button>
    </>
  );
}
