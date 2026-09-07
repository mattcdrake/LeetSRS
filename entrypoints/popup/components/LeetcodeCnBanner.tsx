import { useEffect, useState } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { browser } from 'wxt/browser';
import { isLeetcodeCnUrl } from '@/entrypoints/popup/leetcode';
import { useI18n } from '../contexts/I18nContext';
import { useLeetcodeCnCapability } from '../queries/leetcode-cn';

export const DISMISS_KEY = 'leetsrs:leetcodeCnBannerDismissed';

export function LeetcodeCnBanner() {
  const t = useI18n();
  const { granted, enable, isEnabling } = useLeetcodeCnCapability();
  const [dismissed, setDismissed] = useState(() => Boolean(localStorage.getItem(DISMISS_KEY)));
  const [activeTabUrl, setActiveTabUrl] = useState<string | null>();

  useEffect(() => {
    const loadActiveTabUrl = async () => {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      setActiveTabUrl(activeTab?.url ?? null);
    };

    loadActiveTabUrl();
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  if (granted !== false || dismissed || !isLeetcodeCnUrl(activeTabUrl ?? null)) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
      <span className="flex-1">{t.home.leetcodeCnBanner.message}</span>
      <button
        type="button"
        onClick={enable}
        disabled={isEnabling}
        className="shrink-0 rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        {t.home.leetcodeCnBanner.enable}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.home.leetcodeCnBanner.dismiss}
        className="shrink-0 text-blue-400 hover:text-blue-600 dark:hover:text-blue-100"
      >
        <FaXmark />
      </button>
    </div>
  );
}
