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
    focusRing: '#2563eb',
    borderMenu: 'rgba(0, 0, 0, 0.15)',
    shadowMenu: '0 8px 16px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1)',
    borderAddButton: 'rgba(0, 0, 0, 0.1)',
    addIconFilter: 'grayscale(1) brightness(0.3)',
    ratings: {
      again: { bg: '#c73e3e', hover: '#b13636' },
      hard: { bg: '#d97706', hover: '#c26805' },
      good: { bg: '#4271c4', hover: '#3862b5' },
      easy: { bg: '#3d9156', hover: '#35804a' },
    },
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
    focusRing: '#93c5fd',
    borderMenu: 'rgba(255, 255, 255, 0.12)',
    shadowMenu: '0 8px 16px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3)',
    borderAddButton: 'rgba(255, 255, 255, 0.1)',
    addIconFilter: 'grayscale(1) brightness(2)',
    ratings: {
      again: { bg: '#d14358', hover: '#c13a4f' },
      hard: { bg: '#e88c3a', hover: '#d97d2e' },
      good: { bg: '#5b8fd9', hover: '#4c7ec8' },
      easy: { bg: '#52b169', hover: '#47a05d' },
    },
  },
} as const;

export const RATING_BUTTON_CONFIGS = [
  { rating: 1, key: 'again' },
  { rating: 2, key: 'hard' },
  { rating: 3, key: 'good' },
  { rating: 4, key: 'easy' },
] as const;

export const LEETSRS_BUTTON_COLOR = '#28c244';

export function isDarkMode(): boolean {
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
