import { useSyncExternalStore } from 'react';
import { RATING_COLORS } from '@/shared/ui/rating-colors';

export const THEME_COLORS = {
  light: {
    bgToolbarButton: 'rgba(0, 0, 0, 0.04)',
    bgAddButtonHover: '#e8e8e8',
    bgTooltip: 'white',
    textAddButton: '#333333',
    textTooltip: '#374151',
    borderTooltip: 'rgba(0, 0, 0, 0.08)',
    focusRing: '#2563eb',
    borderMenu: 'rgba(0, 0, 0, 0.15)',
    ratings: RATING_COLORS.light,
  },
  dark: {
    bgToolbarButton: 'rgba(255, 255, 255, 0.08)',
    bgAddButtonHover: '#3a3a3a',
    bgTooltip: 'rgb(40, 40, 40)',
    textAddButton: '#e0e0e0',
    textTooltip: '#e5e7eb',
    borderTooltip: 'rgba(255, 255, 255, 0.08)',
    focusRing: '#93c5fd',
    borderMenu: 'rgba(255, 255, 255, 0.12)',
    ratings: RATING_COLORS.dark,
  },
} as const;

export const LEETSRS_BUTTON_COLOR = '#28c244';

function isDarkMode(): boolean {
  return (
    document.documentElement.classList.contains('dark') ||
    document.documentElement.classList.contains('dark-theme') ||
    document.body.classList.contains('dark') ||
    document.body.classList.contains('dark-theme')
  );
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
