import { LuArrowUpRight, LuStar } from 'react-icons/lu';
import { buttonInteraction } from '@/popup/styles';
import { useI18n } from '../../contexts/I18nContext';
import { settingsCard } from './SettingsGroup';

const APP_VERSION = __APP_VERSION__;
const GITHUB_URL = 'https://github.com/mattcdrake/LeetSRS';
const CHROME_STORE_REVIEWS_URL =
  'https://chromewebstore.google.com/detail/leetsrs/odgfcigkohoimpeeooifjdglncggkgko/reviews?utm_source=item-share-cb';

export function AboutSection() {
  const t = useI18n();
  const links = [
    { href: GITHUB_URL, label: t.settings.about.github },
    { href: 'https://discord.gg/fn24NAzBFu', label: t.settings.about.discord },
    { href: `${GITHUB_URL}/issues`, label: t.settings.about.feedbackLink },
  ];

  return (
    <section aria-label={t.settings.about.title}>
      <a
        href={CHROME_STORE_REVIEWS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${settingsCard} mb-4 flex items-center gap-3 p-3 hover:bg-[color-mix(in_srgb,var(--current-bg-secondary)_50%,var(--current-bg-surface))] ${buttonInteraction}`}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--current-warning)_14%,var(--current-bg-surface))] text-[var(--current-warning)]">
          <LuStar aria-hidden="true" className="size-[18px] fill-current" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-5 text-primary">{t.settings.about.rateTitle}</span>
          <span className="block text-xs leading-4 text-secondary">{t.settings.about.rateBody}</span>
        </span>
        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-accent px-2.5 text-xs font-medium text-on-accent">
          {t.settings.about.rateCta}
          <LuArrowUpRight aria-hidden="true" className="size-3.5" />
        </span>
      </a>
      <footer className="mb-2 flex flex-col items-center gap-2 text-xs text-tertiary">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {links.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded-sm hover:text-primary ${buttonInteraction}`}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span>{t.settings.about.copyright}</span>
          <span aria-hidden="true">·</span>
          <span className="font-jetbrains-mono">{t.format.version(APP_VERSION)}</span>
        </div>
      </footer>
    </section>
  );
}
