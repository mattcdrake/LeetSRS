import { useState } from 'react';
import type { Translations } from '@/i18n';
import { LEETSRS_BUTTON_COLOR, THEME_COLORS } from './constants';
import { useDarkMode } from './useDarkMode';

export function LeetSrsButton({ onClick, t }: { onClick: () => void; t: Translations }) {
  const isDark = useDarkMode();
  const [hovered, setHovered] = useState(false);
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  return (
    <div className="relative flex overflow-hidden rounded" style={{ backgroundColor: colors.bgTertiary }}>
      <div className="group flex flex-none items-center justify-center">
        <button
          type="button"
          className="flex cursor-pointer p-2"
          data-state="closed"
          title={t.app.name}
          aria-label={t.app.name}
          style={{
            color: LEETSRS_BUTTON_COLOR,
            border: 'none',
            background: hovered ? colors.bgAddButtonHover : 'transparent',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={onClick}
        >
          <div className="relative text-[16px] leading-[normal] before:block before:h-4 before:w-4">
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
              className="absolute left-1/2 top-1/2 h-[1em] -translate-x-1/2 -translate-y-1/2 align-[-0.125em]"
              role="img"
            >
              <path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5" />
              <path d="M5.63 7.16l0 .01" />
              <path d="M4.06 11l0 .01" />
              <path d="M4.63 15.1l0 .01" />
              <path d="M7.16 18.37l0 .01" />
              <path d="M11 19.94l0 .01" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
}
