import type { CSSProperties } from 'react';
import { Button } from 'react-aria-components';
import { RATINGS, type Rating } from '@/domain/ratings';
import type { Translations } from '@/i18n';
import { THEME_COLORS, useDarkMode } from './theme';

export type RatingCallback = (rating: Rating) => void;

export function RatingMenu({
  t,
  onRate,
  onAddWithoutRating,
  onSelect,
}: {
  t: Translations;
  onRate: RatingCallback;
  onAddWithoutRating: () => void;
  onSelect: () => void;
}) {
  const colors = useDarkMode() ? THEME_COLORS.dark : THEME_COLORS.light;
  return (
    <div
      className="min-w-40 max-w-[calc(100vw-32px)] rounded-lg border border-(--menu-border) bg-(--menu-bg) p-3 shadow-(--menu-shadow)"
      style={
        {
          '--menu-bg': colors.bgSecondary,
          '--focus-ring': colors.focusRing,
          '--menu-border': colors.borderMenu,
          '--menu-shadow': colors.shadowMenu,
        } as CSSProperties & Record<`--${string}`, string>
      }
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {RATINGS.map((rating) => {
          const { bg, hover } = colors.ratings[rating];
          const label = t.ratings[rating];
          return (
            <Button
              key={rating}
              type="button"
              className="rating-menu-action min-w-16 flex-auto shrink-0 whitespace-nowrap border-0 px-2 py-1.5 text-white"
              style={{ '--button-bg': bg, '--button-hover': hover } as CSSProperties & Record<`--${string}`, string>}
              onPress={() => {
                onRate(rating);
                onSelect();
              }}
            >
              {label}
            </Button>
          );
        })}
      </div>
      <Button
        type="button"
        className="rating-menu-action block w-full px-3 py-1.5 leading-5 no-underline hover:underline"
        style={
          {
            '--button-bg': colors.bgAddButton,
            '--button-hover': colors.bgAddButtonHover,
            color: colors.textAddButton,
            border: `1px solid ${colors.borderAddButton}`,
          } as CSSProperties & Record<`--${string}`, string>
        }
        onPress={() => {
          onAddWithoutRating();
          onSelect();
        }}
      >
        <span aria-hidden="true" style={{ filter: colors.addIconFilter }}>
          ➕
        </span>{' '}
        {t.contentScript.addToSrsNoRating}
      </Button>
    </div>
  );
}
