import { Button, Heading } from 'react-aria-components';
import { FaGithub } from 'react-icons/fa6';
import { FiArrowRight, FiCalendar, FiChevronDown, FiMap, FiX } from 'react-icons/fi';
import { useI18n } from '@/popup/contexts/I18nContext';
import type { PopupDialogContentProps } from './registry';

export function ReleaseAnnouncement({ onDismiss, onOpenRoadmaps }: PopupDialogContentProps) {
  const t = useI18n().releaseAnnouncement;
  return (
    <>
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-2xl"
        >
          🎉
        </span>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">{t.eyebrow}</p>
          <Heading slot="title" className="mt-0.5 text-xl font-semibold tracking-tight">
            {t.title}
          </Heading>
        </div>
        <Button
          aria-label={t.dismiss}
          className="-mt-1 -mr-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-secondary hover:bg-secondary focus-visible:outline-2"
          onPress={onDismiss}
        >
          <FiX aria-hidden="true" className="h-4 w-4" />
        </Button>
      </header>

      <section className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--current-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--current-accent)_7%,var(--current-bg-primary))] p-3.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FiMap aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
          {t.roadmapsTitle}
        </h3>
        <p className="mt-1.5 text-xs leading-5 text-secondary">{t.roadmapsDescription}</p>
      </section>

      <div className="my-3 space-y-3">
        {[
          { Icon: FiCalendar, title: t.calendarTitle, description: t.calendarDescription },
          { Icon: FaGithub, title: t.syncTitle, description: t.syncDescription },
        ].map(({ Icon, title, description }) => (
          <section key={title} className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary">
              <Icon aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-semibold">{title}</h3>
              <p className="mt-1 text-xs leading-[18px] text-secondary">{description}</p>
            </div>
          </section>
        ))}
      </div>

      <details className="group border-t border-current pt-3 text-xs text-secondary">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded font-medium focus-visible:outline-2">
          {t.upgradeTitle}
          <FiChevronDown aria-hidden="true" className="h-3.5 w-3.5 group-open:rotate-180" />
        </summary>
        <p className="mt-2 leading-5">{t.upgradeSync}</p>
      </details>

      <Button
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-[#10230d] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2"
        onPress={() => {
          onDismiss();
          onOpenRoadmaps();
        }}
      >
        {t.tryRoadmaps}
        <FiArrowRight aria-hidden="true" className="h-4 w-4" />
      </Button>
    </>
  );
}
