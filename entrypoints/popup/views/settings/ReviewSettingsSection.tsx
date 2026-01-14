import { TextField, Label, Input } from 'react-aria-components';
import { useMaxNewCardsPerDayQuery, useSetMaxNewCardsPerDayMutation } from '@/hooks/useBackgroundQueries';
import { DEFAULT_MAX_NEW_CARDS_PER_DAY, MIN_NEW_CARDS_PER_DAY, MAX_NEW_CARDS_PER_DAY } from '@/shared/settings';
import { useState, useEffect } from 'react';
import { i18n } from '@/shared/i18n';

export function ReviewSettingsSection() {
  const { data: maxNewCardsPerDay } = useMaxNewCardsPerDayQuery();
  const setMaxNewCardsPerDayMutation = useSetMaxNewCardsPerDayMutation();
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (maxNewCardsPerDay !== undefined) {
      setInputValue(maxNewCardsPerDay.toString());
    }
  }, [maxNewCardsPerDay]);

  const handleBlur = () => {
    const value = parseInt(inputValue, 10);
    if (!isNaN(value) && value >= MIN_NEW_CARDS_PER_DAY && value <= MAX_NEW_CARDS_PER_DAY) {
      setMaxNewCardsPerDayMutation.mutate(value);
    } else {
      // Reset to current value on invalid input
      setInputValue((maxNewCardsPerDay ?? DEFAULT_MAX_NEW_CARDS_PER_DAY).toString());
    }
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">{i18n.settings.reviewSettings.title}</h3>
      <div className="space-y-3">
        <TextField className="flex items-center justify-between">
          <Label>{i18n.settings.reviewSettings.newCardsPerDay}</Label>
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            min={MIN_NEW_CARDS_PER_DAY.toString()}
            max={MAX_NEW_CARDS_PER_DAY.toString()}
            placeholder={DEFAULT_MAX_NEW_CARDS_PER_DAY.toString()}
            className="w-20 px-2 py-1 rounded border bg-tertiary text-primary border-current"
          />
        </TextField>
      </div>
    </div>
  );
}
