import { FaGlobe } from 'react-icons/fa6';
import { useI18n } from '../../contexts/I18nContext';
import { useLeetcodeCnCapability } from '../../queries/leetcode-cn';

export function LeetcodeCnSection() {
  const t = useI18n();
  const { granted, enable, isEnabling } = useLeetcodeCnCapability();

  if (granted !== false) return null;

  return (
    <div className="border-t border-current pt-2">
      <p className="flex items-start gap-2 text-xs text-secondary leading-relaxed mb-2">
        <FaGlobe aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{t.settings.leetcodeCn.description}</span>
      </p>
      <button
        type="button"
        onClick={enable}
        disabled={isEnabling}
        className="min-h-10 rounded-lg border border-current bg-primary px-3 py-2 text-xs text-primary hover:bg-secondary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t.settings.leetcodeCn.enable}
      </button>
    </div>
  );
}
