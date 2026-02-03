import { useAutoClearLeetcodeQuery, useSetAutoClearLeetcodeMutation } from '@/hooks/useBackgroundQueries';
import { DEFAULT_AUTO_CLEAR_LEETCODE } from '@/shared/settings';
import { useI18n } from '../../contexts/I18nContext';
import { SettingsSwitch } from './SettingsSwitch';

export function ProblemAutoClearSection() {
  const t = useI18n();
  const { data: autoClearLeetcode = DEFAULT_AUTO_CLEAR_LEETCODE } = useAutoClearLeetcodeQuery();
  const setAutoClearLeetcodeMutation = useSetAutoClearLeetcodeMutation();

  const toggleLeetcode = () => {
    setAutoClearLeetcodeMutation.mutate(!autoClearLeetcode);
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-2">{t.settings.problemAutoClear.title}</h3>
      <p className="text-sm text-tertiary mb-4">{t.settings.problemAutoClear.description}</p>
      <div className="space-y-3">
        <SettingsSwitch
          label={t.settings.problemAutoClear.enableAutoReset}
          isSelected={autoClearLeetcode}
          onChange={toggleLeetcode}
        />
      </div>
    </div>
  );
}
