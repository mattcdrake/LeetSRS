import { useEffect, useState } from 'react';
import type { Theme } from '@/shared/settings';
import { useSettingsQuery } from './queries/settings';

export type ResolvedTheme = Exclude<Theme, 'system'>;

export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  return theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
}

export function useTheme(): ResolvedTheme {
  const { data: settings } = useSettingsQuery();
  const { theme } = settings;
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    theme === 'system' ? resolveTheme(theme, window.matchMedia('(prefers-color-scheme: dark)').matches) : theme
  );

  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(resolveTheme('system', event.matches));
    };

    setSystemTheme(resolveTheme('system', mediaQuery.matches));
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return theme === 'system' ? systemTheme : theme;
}
