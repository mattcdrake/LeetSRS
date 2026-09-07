import { RATING_COLORS } from './constants';

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
