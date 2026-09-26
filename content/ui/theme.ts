import { useSyncExternalStore } from 'react';

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

// Sets data-theme on each surface root, which scopes the --ls-* tokens.
export function useSurfaceTheme(): 'light' | 'dark' {
  return useDarkMode() ? 'dark' : 'light';
}
