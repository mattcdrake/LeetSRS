import { useEffect, useState } from 'react';
import { Input, Label, TextField } from 'react-aria-components';
import { useSettingsQuery, useUpdateSettingsMutation } from '@/hooks/useBackgroundQueries';
import {
  MAX_DAY_START_HOUR,
  MAX_NEW_CARDS_PER_DAY,
  MIN_DAY_START_HOUR,
  MIN_NEW_CARDS_PER_DAY,
} from '@/shared/settings';
import { useI18n } from '../../contexts/I18nContext';

export function ReviewSettingsSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();
  const [inputValue, setInputValue] = useState('');
  const [dayStartHourValue, setDayStartHourValue] = useState('');

  useEffect(() => {
    setInputValue(settings.maxNewCardsPerDay.toString());
  }, [settings]);

  useEffect(() => {
    setDayStartHourValue(settings.dayStartHour.toString());
  }, [settings]);

  const handleBlur = () => {
    const value = parseInt(inputValue, 10);
    if (!Number.isNaN(value) && value >= MIN_NEW_CARDS_PER_DAY && value <= MAX_NEW_CARDS_PER_DAY) {
      updateSettingsMutation.mutate({ maxNewCardsPerDay: value });
    } else {
      // Reset to current value on invalid input
      setInputValue(settings.maxNewCardsPerDay.toString());
    }
  };

  const handleDayStartBlur = () => {
    const value = parseInt(dayStartHourValue, 10);
    if (!Number.isNaN(value) && value >= MIN_DAY_START_HOUR && value <= MAX_DAY_START_HOUR) {
      updateSettingsMutation.mutate({ dayStartHour: value });
    } else {
      setDayStartHourValue(settings.dayStartHour.toString());
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
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            min={MIN_NEW_CARDS_PER_DAY.toString()}
            max={MAX_NEW_CARDS_PER_DAY.toString()}
            placeholder={settings.maxNewCardsPerDay.toString()}
            className="w-20 px-2 py-1 rounded border bg-tertiary text-primary border-current"
          />
        </TextField>
        <TextField className="flex items-center justify-between">
          <Label>{t.settings.reviewSettings.dayStartHour}</Label>
          <Input
            type="number"
            value={dayStartHourValue}
            onChange={(e) => setDayStartHourValue(e.target.value)}
            onBlur={handleDayStartBlur}
            min={MIN_DAY_START_HOUR.toString()}
            max={MAX_DAY_START_HOUR.toString()}
            step="1"
            placeholder={settings.dayStartHour.toString()}
            className="w-20 px-2 py-1 rounded border bg-tertiary text-primary border-current"
          />
        </TextField>
      </div>
    </div>
  );
}
