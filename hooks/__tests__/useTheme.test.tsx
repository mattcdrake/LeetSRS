/** @vitest-environment happy-dom */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Theme } from '@/shared/settings';
import { resolveTheme, useTheme } from '../useTheme';

const queryMock = vi.hoisted(() => ({ theme: 'system' as Theme }));

vi.mock('../queries/settings', () => ({
  useSettingsQuery: () => ({ data: { theme: queryMock.theme } }),
}));

function createMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
  } as unknown as MediaQueryList;

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mediaQuery)
  );

  return {
    mediaQuery,
    setMatches(value: boolean) {
      matches = value;
      const event = { matches: value, media: mediaQuery.media } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    },
  };
}

function ThemeProbe() {
  return <div>{useTheme()}</div>;
}

describe('useTheme', () => {
  beforeEach(() => {
    queryMock.theme = 'system';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['light', false, 'light'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('resolves %s with prefersDark=%s to %s', (theme, prefersDark, expected) => {
    expect(resolveTheme(theme, prefersDark)).toBe(expected);
  });

  it('returns live OS theme changes in system mode and cleans up the listener', () => {
    const { mediaQuery, setMatches } = createMatchMedia(false);
    const { rerender, unmount } = render(<ThemeProbe />);

    expect(screen.getByText('light')).toBeInTheDocument();
    expect(mediaQuery.addEventListener).toHaveBeenCalledOnce();

    act(() => setMatches(true));
    expect(screen.getByText('dark')).toBeInTheDocument();

    queryMock.theme = 'light';
    rerender(<ThemeProbe />);
    expect(screen.getByText('light')).toBeInTheDocument();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledOnce();

    queryMock.theme = 'system';
    rerender(<ThemeProbe />);
    unmount();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it('returns an explicit theme without subscribing to OS changes', () => {
    const { mediaQuery, setMatches } = createMatchMedia(false);
    queryMock.theme = 'dark';
    render(<ThemeProbe />);

    expect(screen.getByText('dark')).toBeInTheDocument();
    expect(mediaQuery.addEventListener).not.toHaveBeenCalled();

    act(() => setMatches(true));
    expect(screen.getByText('dark')).toBeInTheDocument();
  });
});
