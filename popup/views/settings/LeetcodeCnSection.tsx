import { compactOutlineButton } from '@/popup/styles';
import { useI18n } from '../../contexts/I18nContext';
import { useLeetcodeCnCapability } from '../../queries/leetcode-cn';
import { SettingsRow } from './SettingsGroup';

export function LeetcodeCnSection() {
  const t = useI18n();
  const { granted, enable, isEnabling } = useLeetcodeCnCapability();

  if (granted !== false) return null;

  return (
    <SettingsRow label={t.settings.leetcodeCn.label} hint={t.settings.leetcodeCn.hint} hintId="leetcode-cn-hint">
      <button
        type="button"
        aria-describedby="leetcode-cn-hint"
        onClick={enable}
        disabled={isEnabling}
        className={`${compactOutlineButton} shrink-0`}
      >
        {t.settings.leetcodeCn.enable}
      </button>
    </SettingsRow>
  );
}
