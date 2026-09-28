import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { compactGhostButton, compactOutlineButton } from '@/popup/styles';
import { isLeetcodeCnUrl } from '@/shared/leetcode-links';
import { useI18n } from '../contexts/I18nContext';
import { useLeetcodeCnCapability } from '../queries/leetcode-cn';
import { Notice } from './Notice';

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
    <div className="mb-3">
      <Notice
        tone="info"
        title={t.home.leetcodeCnBanner.message}
        action={
          <div className="flex gap-1.5">
            <button type="button" onClick={enable} disabled={isEnabling} className={compactOutlineButton}>
              {t.home.leetcodeCnBanner.enable}
            </button>
            <button type="button" onClick={dismiss} className={compactGhostButton}>
              {t.home.leetcodeCnBanner.dismiss}
            </button>
          </div>
        }
      />
    </div>
  );
}
