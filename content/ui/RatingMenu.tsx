import type { CSSProperties } from 'react';
import { Button } from 'react-aria-components';
import type { Grade } from 'ts-fsrs';
import { ratingSchema } from '@/domain/ratings';
import type { Translations } from '@/i18n';
import { THEME_COLORS, useDarkMode } from './theme';

export function RatingMenu({
  t,
  onAction,
  isPending,
  error,
}: {
  t: Translations;
  onAction: (rating?: Grade) => Promise<void>;
  isPending: boolean;
  error?: string;
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
        {[...ratingSchema.values].map((rating) => {
          const { bg, hover } = colors.ratings[rating];
          const label = t.ratings[rating];
          return (
            <Button
              key={rating}
              type="button"
              className="rating-menu-action min-w-16 flex-auto shrink-0 whitespace-nowrap border-0 px-2 py-1.5 text-white"
              style={{ '--button-bg': bg, '--button-hover': hover } as CSSProperties & Record<`--${string}`, string>}
              isDisabled={isPending}
              onPress={() => {
                void onAction(rating);
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
        isDisabled={isPending}
        onPress={() => {
          void onAction();
        }}
      >
        <span aria-hidden="true" style={{ filter: colors.addIconFilter }}>
          ➕
        </span>{' '}
        {t.contentScript.addToSrsNoRating}
      </Button>
      {error && (
        <p role="alert" className="mt-2 max-w-72 text-sm text-red-500">
          {error}
        </p>
      )}
      {isPending && (
        <p role="status" className="mt-2 text-sm">
          {t.actions.saving}
        </p>
      )}
    </div>
  );
}
