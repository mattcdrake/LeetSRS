import { useSettingsQuery, useUpdateSettingsMutation } from '@/popup/queries/settings';
import { useI18n } from '../../contexts/I18nContext';
import { SettingsSwitch } from './SettingsSwitch';

export function EditorResetSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();

  return (
    <div className="space-y-4">
      <SettingsSwitch
        label={t.settings.editorReset.resetEditorOnReviewQueue}
        isSelected={settings.resetEditorOnReviewQueue}
        onChange={(value) => updateSettingsMutation.mutate({ resetEditorOnReviewQueue: value })}
      />
    </div>
  );
}
