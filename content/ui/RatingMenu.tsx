import type { CSSProperties } from 'react';
import type { Translations } from '@/i18n';
import { getRatingColor, RATING_BUTTON_CONFIGS, THEME_COLORS, useDarkMode } from './theme';
import styles from './ui.module.css';

export type RatingCallback = (rating: number, label: string) => void;
export type RatingMenuPosition = 'top' | 'bottom';

export function RatingMenu({
  t,
  position = 'bottom',
  onRate,
  onAddWithoutRating,
  onSelect,
}: {
  t: Translations;
  position?: RatingMenuPosition;
  onRate: RatingCallback;
  onAddWithoutRating: () => void;
  onSelect: () => void;
}) {
  const isDark = useDarkMode();
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  return (
    <div
      className={styles.menu}
      style={
        {
          ...(position === 'top' ? { bottom: '100%', marginBottom: 8 } : { top: '100%', marginTop: 8 }),
          '--menu-bg': colors.bgSecondary,
          '--menu-border': isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.15)',
          '--menu-shadow': isDark
            ? '0 8px 16px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3)'
            : '0 8px 16px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1)',
        } as CSSProperties & Record<`--${string}`, string>
      }
    >
      <div className={styles.ratings}>
        {RATING_BUTTON_CONFIGS.map(({ rating, labelKey, colorKey }) => {
          const { bg, hover } = getRatingColor(colorKey, isDark);
          const label = t.ratings[labelKey];
          return (
            <button
              key={rating}
              type="button"
              className={styles.rating}
              style={{ '--button-bg': bg, '--button-hover': hover } as CSSProperties & Record<`--${string}`, string>}
              onClick={() => {
                onRate(rating, label);
                onSelect();
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.add}
        style={
          {
            '--button-bg': colors.bgAddButton,
            '--button-hover': colors.bgAddButtonHover,
            color: colors.textAddButton,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          } as CSSProperties & Record<`--${string}`, string>
        }
        onClick={() => {
          onAddWithoutRating();
          onSelect();
        }}
      >
        <span aria-hidden="true" style={{ filter: `grayscale(1) brightness(${isDark ? '2' : '0.3'})` }}>
          ➕
        </span>{' '}
        {t.contentScript.addToSrsNoRating}
      </button>
    </div>
  );
}
