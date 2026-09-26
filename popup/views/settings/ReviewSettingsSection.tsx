import { useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { LuMinus, LuPlus } from 'react-icons/lu';
import { useDraftUntilSaved } from '@/popup/hooks/useDraftUntilSaved';
import { useSettingsQuery, useUpdateSettingsMutation } from '@/popup/queries/settings';
import { buttonInteraction } from '@/popup/styles';
import { SETTINGS_CONSTRAINTS } from '@/shared/settings';
import { useI18n } from '../../contexts/I18nContext';
import { RowText, SettingsCard, SettingsSection } from './SettingsGroup';
import { SettingsSwitch } from './SettingsSwitch';

const { min, max } = SETTINGS_CONSTRAINTS.maxNewCardsPerDay;
const stepButton = `grid h-full w-7 place-items-center text-tertiary hover:bg-secondary hover:text-primary ${buttonInteraction}`;

const clamp = (limit: number) => Math.min(max, Math.max(min, limit));

function parseLimit(value: string) {
  const limit = Number(value.trim());
  return value.trim() !== '' && Number.isInteger(limit) && limit >= min && limit <= max ? limit : null;
}

export function ReviewSettingsSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();
  const draft = useDraftUntilSaved(settings.maxNewCardsPerDay.toString());
  const [isInvalid, setIsInvalid] = useState(false);
  const inputValue = draft.value;

  const save = (limit: number) => {
    const saved = limit.toString();
    draft.setValue(saved);
    setIsInvalid(false);
    updateSettingsMutation.mutate({ maxNewCardsPerDay: limit }, { onSuccess: () => draft.markSaved(saved) });
  };

  const handleBlur = () => {
    if (!draft.hasDraft) return;
    const limit = parseLimit(inputValue);
    if (limit === null) setIsInvalid(true);
    else save(limit);
  };

  // Steps start from the typed value, clamped into range, so an out-of-range draft recovers in one press.
  const typed = Number(inputValue.trim());
  const current =
    inputValue.trim() !== '' && Number.isFinite(typed) ? clamp(Math.round(typed)) : settings.maxNewCardsPerDay;

  return (
    <SettingsSection id="reviews-heading" title={t.settings.groups.reviews}>
      <SettingsCard>
        <div className="mx-3.5 py-2">
          <TextField
            className="flex min-h-7 items-center gap-3"
            aria-describedby={isInvalid ? 'new-cards-hint new-cards-error' : 'new-cards-hint'}
            isInvalid={isInvalid}
            value={inputValue}
            onChange={(value) => {
              draft.setValue(value);
              setIsInvalid(false);
            }}
          >
            <RowText
              label={<Label>{t.settings.reviewSettings.newCardsPerDay}</Label>}
              hint={t.settings.reviewSettings.newCardsHint(min, max)}
              hintId="new-cards-hint"
            />
            <div
              className={`inline-flex h-7 shrink-0 items-center overflow-hidden rounded-md border has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[color:var(--current-accent)] ${isInvalid ? 'border-[var(--current-danger)]' : 'border-strong'}`}
            >
              <Button
                aria-label={t.settings.reviewSettings.decrease}
                className={stepButton}
                isDisabled={current <= min && !isInvalid}
                onPress={() => save(clamp(current - 1))}
              >
                <LuMinus aria-hidden="true" className="size-3.5" />
              </Button>
              <Input
                type="number"
                onBlur={handleBlur}
                min={min.toString()}
                max={max.toString()}
                placeholder={settings.maxNewCardsPerDay.toString()}
                className="h-full w-8 bg-transparent text-center text-xs font-medium tabular-nums text-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Button
                aria-label={t.settings.reviewSettings.increase}
                className={stepButton}
                isDisabled={current >= max && !isInvalid}
                onPress={() => save(clamp(current + 1))}
              >
                <LuPlus aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          </TextField>
          {isInvalid && (
            <p id="new-cards-error" role="alert" className="mt-1 text-xs leading-4 text-danger">
              {t.settings.reviewSettings.newCardsError(min, max)}
            </p>
          )}
        </div>
        <SettingsSwitch
          label={t.settings.editorReset.resetEditorOnReviewQueue}
          hint={t.settings.editorReset.hint}
          isSelected={settings.resetEditorOnReviewQueue}
          onChange={(resetEditorOnReviewQueue) => updateSettingsMutation.mutate({ resetEditorOnReviewQueue })}
        />
        <SettingsSwitch
          label={t.settings.reviewSettings.openRatingAfterSolving}
          hint={t.settings.reviewSettings.openRatingHint}
          isSelected={settings.openRatingAfterSolving}
          isDisabled={updateSettingsMutation.isPending}
          onChange={(openRatingAfterSolving) => updateSettingsMutation.mutate({ openRatingAfterSolving })}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
