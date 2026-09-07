import type { CSSProperties } from 'react';
import { Button } from 'react-aria-components';
import type { Translations } from '@/i18n';
import { RATING_BUTTON_CONFIGS, THEME_COLORS, useDarkMode } from './theme';

export type RatingCallback = (rating: number) => void;

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
      className="min-w-40 rounded-lg border border-(--menu-border) bg-(--menu-bg) p-3 shadow-(--menu-shadow)"
      style={
        {
          '--menu-bg': colors.bgSecondary,
          '--focus-ring': colors.focusRing,
          '--menu-border': colors.borderMenu,
          '--menu-shadow': colors.shadowMenu,
        } as CSSProperties & Record<`--${string}`, string>
      }
    >
      <div className="mb-2 flex gap-1">
        {RATING_BUTTON_CONFIGS.map(({ rating, key }) => {
          const { bg, hover } = colors.ratings[key];
          const label = t.ratings[key];
          return (
            <Button
              key={rating}
              type="button"
              className="rating-menu-action w-16 border-0 p-2 text-white"
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
