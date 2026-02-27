import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { SettingsSwitch } from './SettingsSwitch';

const LEETCODE_CN_ORIGIN = '*://*.leetcode.cn/*';

export function LeetcodeCnSection() {
  const t = useI18n();
  const [enabled, setEnabled] = useState(false);

  const checkPermission = useCallback(async () => {
    const granted = await browser.permissions.contains({ origins: [LEETCODE_CN_ORIGIN] });
    setEnabled(granted);
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const toggle = async () => {
    if (enabled) {
      await browser.permissions.remove({ origins: [LEETCODE_CN_ORIGIN] });
    } else {
      await browser.permissions.request({ origins: [LEETCODE_CN_ORIGIN] });
    }
    await checkPermission();
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-2">{t.settings.leetcodeCn.title}</h3>
      <p className="text-sm text-tertiary mb-4">{t.settings.leetcodeCn.description}</p>
      <div className="space-y-3">
        <SettingsSwitch label={t.settings.leetcodeCn.enable} isSelected={enabled} onChange={toggle} />
      </div>
    </div>
  );
}
