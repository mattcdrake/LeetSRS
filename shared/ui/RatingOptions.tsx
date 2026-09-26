import { type CSSProperties, useId } from 'react';
import { Button } from 'react-aria-components';
import { LuPlus } from 'react-icons/lu';
import type { Grade } from 'ts-fsrs';
import type { Translations } from '@/shared/i18n';
import { type RatingPreview, ratingSchema } from '@/shared/learning-document';

interface RatingOptionsProps {
  t: Translations;
  colors: Record<Grade, string>;
  preview?: RatingPreview;
  disabled: boolean;
  onSave: (rating?: Grade) => void;
  allowUnrated?: boolean;
  // Compact rows show keyboard shortcuts for the LeetCode panel; comfortable rows suit the popup sheet.
  size?: 'compact' | 'comfortable';
  selected?: number;
}

export function RatingOptions({
  t,
  colors,
  preview,
  disabled,
  onSave,
  allowUnrated = true,
  size = 'compact',
  selected,
}: RatingOptionsProps) {
  const id = useId();
  const shortcuts = size === 'compact';
  return (
    <div className="rating-options" data-size={size} data-loading={!preview || undefined}>
      <div className="rating-list">
        {[...ratingSchema.values].map((rating) => (
          <Button
            key={rating}
            className="rating-row"
            aria-label={t.ratings[rating]}
            aria-describedby={`${id}-${rating}-description ${id}-${rating}-interval`}
            data-selected={selected === rating || undefined}
            isDisabled={disabled || !preview}
            onPress={() => onSave(rating)}
            style={{ '--rating-color': colors[rating] } as CSSProperties}
          >
            <span className="rating-dot-slot" aria-hidden="true">
              <span className="rating-dot" />
            </span>
            <span className="rating-label">{t.ratings[rating]}</span>
            <span className="rating-description" id={`${id}-${rating}-description`}>
              {t.contentScript.descriptions[rating]}
            </span>
            <span className="rating-interval" id={`${id}-${rating}-interval`}>
              {preview ? t.contentScript.days(preview[rating]) : <span className="rating-skeleton" />}
            </span>
            {shortcuts && <kbd className="rating-kbd">{rating}</kbd>}
          </Button>
        ))}
      </div>
      {allowUnrated && (
        <>
          <div className="rating-divider" />
          <Button
            className="rating-without"
            data-selected={selected === 5 || undefined}
            aria-label={t.contentScript.saveWithoutRating}
            isDisabled={disabled}
            onPress={() => onSave()}
          >
            <span className="rating-dot-slot" aria-hidden="true">
              <LuPlus className="size-3.5 shrink-0" />
            </span>
            <span>{t.contentScript.saveWithoutRating}</span>
            {shortcuts && <kbd className="rating-kbd">5</kbd>}
          </Button>
        </>
      )}
    </div>
  );
}
