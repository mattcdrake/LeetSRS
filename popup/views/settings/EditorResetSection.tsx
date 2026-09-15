import { useSettingsQuery, useUpdateSettingsMutation } from '@/popup/queries/settings';
import { useI18n } from '../../contexts/I18nContext';
import { SettingsSwitch } from './SettingsSwitch';

export function EditorResetSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-2">{t.settings.editorReset.title}</h3>
      <p className="text-sm text-tertiary mb-4">{t.settings.editorReset.description}</p>
      <SettingsSwitch
        label={t.settings.editorReset.resetEditorOnReviewQueue}
        isSelected={settings.resetEditorOnReviewQueue}
        onChange={(value) => updateSettingsMutation.mutate({ resetEditorOnReviewQueue: value })}
      />
    </div>
  );
}
