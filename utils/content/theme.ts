import { THEME_COLORS, RATING_COLORS } from './constants';

export function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function getThemeColor(lightColor: string, darkColor: string): string {
  return isDarkMode() ? darkColor : lightColor;
}

export function getRatingColor(colorClass: keyof typeof RATING_COLORS) {
  const colors = RATING_COLORS[colorClass];
  const isDark = isDarkMode();
  return {
    bg: isDark ? colors.darkBg : colors.bg,
    hover: isDark ? colors.darkHover : colors.hover,
  };
}

export function getThemeColors() {
  return isDarkMode() ? THEME_COLORS.dark : THEME_COLORS.light;
}
