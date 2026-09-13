import { useState } from 'react';
import { Input, Label, TextField } from 'react-aria-components';
import { SETTINGS_CONSTRAINTS } from '@/domain/settings';
import { useSettingsQuery, useUpdateSettingsMutation } from '@/entrypoints/popup/queries/settings';
import { useI18n } from '../../contexts/I18nContext';

export function ReviewSettingsSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();
  const [draft, setDraft] = useState<string | null>(null);
  const inputValue = draft ?? settings.maxNewCardsPerDay.toString();

  const handleBlur = () => {
    if (draft === null) return;
    const value = parseInt(inputValue, 10);
    if (
      !Number.isNaN(value) &&
      value >= SETTINGS_CONSTRAINTS.maxNewCardsPerDay.min &&
      value <= SETTINGS_CONSTRAINTS.maxNewCardsPerDay.max
    ) {
      updateSettingsMutation.mutate(
        { maxNewCardsPerDay: value },
        {
          onSuccess: () => setDraft((current) => (current === draft ? null : current)),
        }
      );
    } else {
      setDraft(null);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">{t.settings.reviewSettings.title}</h3>
      <div className="space-y-3">
        <TextField className="flex items-center justify-between">
          <Label>{t.settings.reviewSettings.newCardsPerDay}</Label>
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            min={SETTINGS_CONSTRAINTS.maxNewCardsPerDay.min.toString()}
            max={SETTINGS_CONSTRAINTS.maxNewCardsPerDay.max.toString()}
            placeholder={settings.maxNewCardsPerDay.toString()}
            className="w-20 px-2 py-1 rounded border bg-tertiary text-primary border-current"
          />
        </TextField>
      </div>
    </div>
  );
}
