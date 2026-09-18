import { FaDiscord, FaGithub, FaRegMessage, FaRegStar } from 'react-icons/fa6';
import { useI18n } from '../../contexts/I18nContext';

const APP_VERSION = __APP_VERSION__;
const GITHUB_URL = 'https://github.com/mattcdrake/LeetSRS';
const CHROME_STORE_REVIEWS_URL =
  'https://chromewebstore.google.com/detail/leetsrs/odgfcigkohoimpeeooifjdglncggkgko/reviews?utm_source=item-share-cb';

export function AboutSection() {
  const t = useI18n();
  const links = [
    { href: CHROME_STORE_REVIEWS_URL, label: t.settings.about.reviewRequest, Icon: FaRegStar },
    { href: GITHUB_URL, label: t.settings.about.github, Icon: FaGithub },
    { href: 'https://discord.gg/fn24NAzBFu', label: t.settings.about.discord, Icon: FaDiscord },
    { href: `${GITHUB_URL}/issues`, label: t.settings.about.feedbackLink, Icon: FaRegMessage },
  ];

  return (
    <section aria-label={t.settings.about.title} className="mb-3 pt-3 border-t border-current text-primary">
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg bg-secondary p-2">
        {links.map(({ href, label, Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-9 items-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors hover:bg-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            <Icon aria-hidden="true" className="size-3.5 shrink-0 text-secondary" />
            <span>{label}</span>
          </a>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-secondary">
        <span>{t.settings.about.copyright}</span>
        <span className="font-jetbrains-mono">{t.format.version(APP_VERSION)}</span>
      </div>
    </section>
  );
}
