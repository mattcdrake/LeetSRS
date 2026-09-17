import { Input, Label, TextField } from 'react-aria-components';
import { FaCode, FaRegCalendarPlus, FaRegWindowRestore } from 'react-icons/fa6';
import { useDraftUntilSaved } from '@/popup/hooks/useDraftUntilSaved';
import { useSettingsQuery, useUpdateSettingsMutation } from '@/popup/queries/settings';
import { SETTINGS_CONSTRAINTS } from '@/shared/settings';
import { useI18n } from '../../contexts/I18nContext';
import { SettingsSwitch } from './SettingsSwitch';

export function ReviewSettingsSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();
  const draft = useDraftUntilSaved(settings.maxNewCardsPerDay.toString());
  const inputValue = draft.value;

  const handleBlur = () => {
    if (!draft.hasDraft) return;
    const value = parseInt(inputValue, 10);
    if (
      !Number.isNaN(value) &&
      value >= SETTINGS_CONSTRAINTS.maxNewCardsPerDay.min &&
      value <= SETTINGS_CONSTRAINTS.maxNewCardsPerDay.max
    ) {
      updateSettingsMutation.mutate(
        { maxNewCardsPerDay: value },
        {
          onSuccess: draft.markSaved,
        }
      );
    } else {
      draft.discard();
    }
  };

  return (
    <section
      aria-labelledby="reviews-heading"
      className="mb-3 pt-3 border-t border-current space-y-1 text-xs text-primary"
    >
      <h3 id="reviews-heading" className="text-sm font-medium">
        {t.settings.groups.reviews}
      </h3>
      <div className="space-y-3">
        <TextField className="flex min-h-10 items-center justify-between gap-3">
          <Label className="flex items-center gap-2">
            <FaRegCalendarPlus aria-hidden="true" className="w-4 h-4 shrink-0 text-secondary" />
            {t.settings.reviewSettings.newCardsPerDay}
          </Label>
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => draft.setValue(e.target.value)}
            onBlur={handleBlur}
            min={SETTINGS_CONSTRAINTS.maxNewCardsPerDay.min.toString()}
            max={SETTINGS_CONSTRAINTS.maxNewCardsPerDay.max.toString()}
            placeholder={settings.maxNewCardsPerDay.toString()}
            className="w-20 shrink-0 min-h-10 px-3 py-2 rounded-lg border bg-primary text-primary border-current"
          />
        </TextField>
      </div>
      <SettingsSwitch
        label={t.settings.editorReset.resetEditorOnReviewQueue}
        icon={FaCode}
        isSelected={settings.resetEditorOnReviewQueue}
        onChange={(resetEditorOnReviewQueue) => updateSettingsMutation.mutate({ resetEditorOnReviewQueue })}
      />
      <SettingsSwitch
        label={t.settings.reviewSettings.openRatingAfterSolving}
        icon={FaRegWindowRestore}
        isSelected={settings.openRatingAfterSolving}
        isDisabled={updateSettingsMutation.isPending}
        onChange={(openRatingAfterSolving) => updateSettingsMutation.mutate({ openRatingAfterSolving })}
      />
    </section>
  );
}
