import { useSyncExternalStore } from 'react';

export const THEME_COLORS = {
  light: {
    bgToolbarButton: 'rgba(0, 0, 0, 0.04)',
    bgSecondary: '#f5f5f5',
    bgAddButton: '#f5f5f5',
    bgAddButtonHover: '#e8e8e8',
    bgTooltip: 'white',
    textAddButton: '#333333',
    textTooltip: '#374151',
    borderTooltip: 'rgba(0, 0, 0, 0.08)',
    ratingAgain: '#c73e3e',
    ratingHard: '#d97706',
    ratingGood: '#4271c4',
    ratingEasy: '#3d9156',
  },
  dark: {
    bgToolbarButton: 'rgba(255, 255, 255, 0.08)',
    bgSecondary: '#242424',
    bgAddButton: '#2e2e2e',
    bgAddButtonHover: '#3a3a3a',
    bgTooltip: 'rgb(40, 40, 40)',
    textAddButton: '#e0e0e0',
    textTooltip: '#e5e7eb',
    borderTooltip: 'rgba(255, 255, 255, 0.08)',
    ratingAgain: '#d14358',
    ratingHard: '#e88c3a',
    ratingGood: '#5b8fd9',
    ratingEasy: '#52b169',
  },
} as const;

export const RATING_COLORS = {
  again: {
    bg: THEME_COLORS.light.ratingAgain,
    hover: '#b13636',
    darkBg: THEME_COLORS.dark.ratingAgain,
    darkHover: '#c13a4f',
  },
  hard: {
    bg: THEME_COLORS.light.ratingHard,
    hover: '#c26805',
    darkBg: THEME_COLORS.dark.ratingHard,
    darkHover: '#d97d2e',
  },
  good: {
    bg: THEME_COLORS.light.ratingGood,
    hover: '#3862b5',
    darkBg: THEME_COLORS.dark.ratingGood,
    darkHover: '#4c7ec8',
  },
  easy: {
    bg: THEME_COLORS.light.ratingEasy,
    hover: '#35804a',
    darkBg: THEME_COLORS.dark.ratingEasy,
    darkHover: '#47a05d',
  },
} as const;

export const RATING_BUTTON_CONFIGS = [
  { rating: 1, labelKey: 'again' as const, colorKey: 'again' as const },
  { rating: 2, labelKey: 'hard' as const, colorKey: 'hard' as const },
  { rating: 3, labelKey: 'good' as const, colorKey: 'good' as const },
  { rating: 4, labelKey: 'easy' as const, colorKey: 'easy' as const },
];

export const LEETSRS_BUTTON_COLOR = '#28c244';

export function isDarkMode(): boolean {
  return (
    document.documentElement.classList.contains('dark') ||
    document.documentElement.classList.contains('dark-theme') ||
    document.body.classList.contains('dark') ||
    document.body.classList.contains('dark-theme')
  );
}

export function getRatingColor(colorClass: keyof typeof RATING_COLORS, isDark = isDarkMode()) {
  const colors = RATING_COLORS[colorClass];
  return {
    bg: isDark ? colors.darkBg : colors.bg,
    hover: isDark ? colors.darkHover : colors.hover,
  };
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  const options = { attributes: true, attributeFilter: ['class'] };
  observer.observe(document.documentElement, options);
  observer.observe(document.body, options);
  return () => observer.disconnect();
}

export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribe, isDarkMode);
}
