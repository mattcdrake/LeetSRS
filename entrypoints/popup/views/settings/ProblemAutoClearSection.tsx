import { useSettingsQuery, useUpdateSettingsMutation } from '@/hooks/useBackgroundQueries';
import { useI18n } from '../../contexts/I18nContext';
import { SettingsSwitch } from './SettingsSwitch';

export function ProblemAutoClearSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();

  if (!settings) return null;

  const setResetEditorOnEveryProblem = (isSelected: boolean) => {
    updateSettingsMutation.mutate({ resetEditorOnEveryProblem: isSelected });
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-2">{t.settings.problemAutoClear.title}</h3>
      <p className="text-sm text-tertiary mb-4">{t.settings.problemAutoClear.description}</p>
      <div className="space-y-3">
        <SettingsSwitch
          label={t.settings.problemAutoClear.resetEditorOnEveryProblem}
          isSelected={settings.resetEditorOnEveryProblem}
          onChange={setResetEditorOnEveryProblem}
        />
        <SettingsSwitch
          label={t.settings.problemAutoClear.resetEditorOnDueReview}
          isSelected={settings.resetEditorOnDueReview}
          onChange={(value) => updateSettingsMutation.mutate({ resetEditorOnDueReview: value })}
        />
      </div>
    </div>
  );
}
