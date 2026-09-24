import { type CSSProperties, useId } from 'react';
import { Button } from 'react-aria-components';
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
  shortcuts?: boolean;
  selected?: number;
}

export function RatingOptions({
  t,
  colors,
  preview,
  disabled,
  onSave,
  allowUnrated = true,
  shortcuts = false,
  selected,
}: RatingOptionsProps) {
  const id = useId();
  return (
    <>
      <div className="rating-options">
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
            <span className="rating-stripe" aria-hidden="true" />
            <span className="rating-label">
              {t.ratings[rating]}
              <small id={`${id}-${rating}-description`}>{t.contentScript.descriptions[rating]}</small>
            </span>
            <span className="rating-interval" id={`${id}-${rating}-interval`}>
              {preview ? t.contentScript.days(preview[rating]) : '…'}
            </span>
            {shortcuts && <kbd>{rating}</kbd>}
          </Button>
        ))}
      </div>
      {allowUnrated && (
        <Button
          className="rating-without"
          data-selected={selected === 5 || undefined}
          aria-label={t.contentScript.saveWithoutRating}
          isDisabled={disabled}
          onPress={() => onSave()}
        >
          <span aria-hidden="true">+</span>
          <span>{t.contentScript.saveWithoutRating}</span>
          {shortcuts && <kbd>5</kbd>}
        </Button>
      )}
    </>
  );
}
