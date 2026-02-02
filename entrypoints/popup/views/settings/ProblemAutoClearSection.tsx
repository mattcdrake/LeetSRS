import { useAutoClearLeetcodeQuery, useSetAutoClearLeetcodeMutation } from '@/hooks/useBackgroundQueries';
import { DEFAULT_AUTO_CLEAR_LEETCODE } from '@/shared/settings';
import { i18n } from '@/shared/i18n';
import { SettingsSwitch } from './SettingsSwitch';

export function ProblemAutoClearSection() {
  const { data: autoClearLeetcode = DEFAULT_AUTO_CLEAR_LEETCODE } = useAutoClearLeetcodeQuery();
  const setAutoClearLeetcodeMutation = useSetAutoClearLeetcodeMutation();

  const toggleLeetcode = () => {
    setAutoClearLeetcodeMutation.mutate(!autoClearLeetcode);
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-2">{i18n.settings.problemAutoClear.title}</h3>
      <p className="text-sm text-tertiary mb-4">{i18n.settings.problemAutoClear.description}</p>
      <div className="space-y-3">
        <SettingsSwitch
          label={i18n.settings.problemAutoClear.enableAutoReset}
          isSelected={autoClearLeetcode}
          onChange={toggleLeetcode}
        />
      </div>
    </div>
  );
}
