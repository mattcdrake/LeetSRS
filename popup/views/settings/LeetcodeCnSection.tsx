import { useI18n } from '../../contexts/I18nContext';
import { useLeetcodeCnCapability } from '../../queries/leetcode-cn';

export function LeetcodeCnSection() {
  const t = useI18n();
  const { granted, enable, isEnabling } = useLeetcodeCnCapability();

  if (granted !== false) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-tertiary mb-4">{t.settings.leetcodeCn.description}</p>
      <button
        type="button"
        onClick={enable}
        disabled={isEnabling}
        className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        {t.settings.leetcodeCn.enable}
      </button>
    </div>
  );
}
