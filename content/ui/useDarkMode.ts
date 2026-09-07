import { useSyncExternalStore } from 'react';
import { isDarkMode } from './theme';

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
