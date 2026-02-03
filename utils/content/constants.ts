// Theme colors from App.css
export const THEME_COLORS = {
  light: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f5f5f5',
    bgTertiary: '#e8e8e8',
    bgAddButton: '#f5f5f5',
    bgAddButtonHover: '#e8e8e8',
    bgTooltip: 'white',
    textPrimary: '#1a1a1a',
    textSecondary: '#4a4a4a',
    textAddButton: '#333333',
    textTooltip: '#374151',
    border: '#d4d4d4',
    borderTooltip: 'rgba(0, 0, 0, 0.08)',
    ratingAgain: '#c73e3e',
    ratingHard: '#d97706',
    ratingGood: '#4271c4',
    ratingEasy: '#3d9156',
  },
  dark: {
    bgPrimary: '#1a1a1a',
    bgSecondary: '#242424',
    bgTertiary: '#2a2a2a',
    bgQuaternary: '#3a3a3a',
    bgButton: '#323232',
    bgAddButton: '#2e2e2e',
    bgAddButtonHover: '#3a3a3a',
    bgTooltip: 'rgb(40, 40, 40)',
    textPrimary: '#ffffff',
    textSecondary: '#a0a0a0',
    textAddButton: '#e0e0e0',
    textTooltip: '#e5e7eb',
    border: '#333333',
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

// Rating button config - labels are looked up dynamically from translations
export const RATING_BUTTON_CONFIGS = [
  { rating: 1, labelKey: 'again' as const, colorKey: 'again' as const },
  { rating: 2, labelKey: 'hard' as const, colorKey: 'hard' as const },
  { rating: 3, labelKey: 'good' as const, colorKey: 'good' as const },
  { rating: 4, labelKey: 'easy' as const, colorKey: 'easy' as const },
];

export const LEETSRS_BUTTON_COLOR = '#28c244';
