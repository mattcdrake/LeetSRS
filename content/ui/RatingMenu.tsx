import { useState } from 'react';
import type { Translations } from '@/i18n';
import { RATING_BUTTON_CONFIGS, THEME_COLORS } from './constants';
import { getRatingColor } from './theme';
import { useDarkMode } from './useDarkMode';

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
  const [hovered, setHovered] = useState<number | null>(null);
  const isDark = useDarkMode();
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        ...(position === 'top' ? { bottom: '100%', marginBottom: 8 } : { top: '100%', marginTop: 8 }),
        minWidth: 160,
        backgroundColor: colors.bgSecondary,
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.15)'}`,
        borderRadius: 8,
        padding: 12,
        boxShadow: isDark
          ? '0 8px 16px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3)'
          : '0 8px 16px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1)',
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {RATING_BUTTON_CONFIGS.map(({ rating, labelKey, colorKey }) => {
          const { bg, hover } = getRatingColor(colorKey, isDark);
          const label = t.ratings[labelKey];
          return (
            <button
              key={rating}
              type="button"
              style={{
                width: 64,
                padding: '8px',
                borderRadius: 4,
                backgroundColor: hovered === rating ? hover : bg,
                color: 'white',
                fontSize: 13,
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                height: 32,
              }}
              onMouseEnter={() => setHovered(rating)}
              onMouseLeave={() => setHovered(null)}
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
        style={{
          width: '100%',
          padding: '6px 12px',
          borderRadius: 4,
          backgroundColor: hovered === 0 ? colors.bgAddButtonHover : colors.bgAddButton,
          color: colors.textAddButton,
          fontSize: 13,
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'block',
          textDecoration: hovered === 0 ? 'underline' : 'none',
          height: 32,
          lineHeight: '20px',
        }}
        onMouseEnter={() => setHovered(0)}
        onMouseLeave={() => setHovered(null)}
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
