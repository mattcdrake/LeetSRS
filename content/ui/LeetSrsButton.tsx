import type { CSSProperties, MouseEventHandler } from 'react';
import type { Translations } from '@/i18n';
import { LEETSRS_BUTTON_COLOR, THEME_COLORS } from './constants';
import styles from './ui.module.css';
import { useDarkMode } from './useDarkMode';

export function LeetSrsButton({
  onClick,
  t,
  expanded = false,
  onMouseEnter,
  onMouseLeave,
}: {
  onClick: () => void;
  t: Translations;
  expanded?: boolean;
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
}) {
  const colors = useDarkMode() ? THEME_COLORS.dark : THEME_COLORS.light;
  return (
    <button
      type="button"
      className={styles.toolbarButton}
      title={t.app.name}
      aria-label={t.app.name}
      aria-expanded={expanded}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={
        {
          color: LEETSRS_BUTTON_COLOR,
          '--button-bg': colors.bgToolbarButton,
          '--button-hover': colors.bgAddButtonHover,
        } as CSSProperties & Record<`--${string}`, string>
      }
    >
      <svg
        aria-hidden="true"
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: 16, height: 16 }}
        role="img"
      >
        <path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5" />
        <path d="M5.63 7.16l0 .01" />
        <path d="M4.06 11l0 .01" />
        <path d="M4.63 15.1l0 .01" />
        <path d="M7.16 18.37l0 .01" />
        <path d="M11 19.94l0 .01" />
      </svg>
    </button>
  );
}
