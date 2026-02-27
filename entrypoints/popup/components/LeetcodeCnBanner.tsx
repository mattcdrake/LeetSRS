import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';

const LEETCODE_CN_ORIGIN = '*://*.leetcode.cn/*';
const DISMISS_KEY = 'leetsrs:leetcodeCnBannerDismissed';

export function LeetcodeCnBanner() {
  const t = useI18n();
  const [visible, setVisible] = useState(false);

  const check = useCallback(async () => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    const granted = await browser.permissions.contains({ origins: [LEETCODE_CN_ORIGIN] });
    if (!granted) setVisible(true);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const enable = async () => {
    await browser.permissions.request({ origins: [LEETCODE_CN_ORIGIN] });
    const granted = await browser.permissions.contains({ origins: [LEETCODE_CN_ORIGIN] });
    if (granted) setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
      <span className="flex-1">{t.home.leetcodeCnBanner.message}</span>
      <button
        onClick={enable}
        className="shrink-0 rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        {t.home.leetcodeCnBanner.enable}
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-blue-400 hover:text-blue-600 dark:hover:text-blue-100"
      >
        ✕
      </button>
    </div>
  );
}
