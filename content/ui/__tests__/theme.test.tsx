// @vitest-environment happy-dom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { LeetSrsButton } from '../LeetSrsControl';
import { RatingMenu } from '../RatingMenu';
import { Tooltip } from '../Tooltip';
import { getRatingColor, isDarkMode, type RATING_COLORS, THEME_COLORS } from '../theme';

afterEach(() => {
  document.documentElement.className = '';
  document.body.className = '';
});

it.each([
  ['html', 'dark'],
  ['html', 'dark-theme'],
  ['body', 'dark'],
  ['body', 'dark-theme'],
])('updates mounted surfaces when %s toggles %s', async (element, className) => {
  const target = document.createElement('button');
  render(
    <>
      <LeetSrsButton t={translations.en} onClick={vi.fn()} />
      <RatingMenu t={translations.en} onRate={vi.fn()} onAddWithoutRating={vi.fn()} onSelect={vi.fn()} />
      <Tooltip target={target} text="Theme tooltip" delay={0} />
    </>
  );
  const tooltip = await screen.findByRole('tooltip');
  const rating = screen.getByRole('button', { name: translations.en.ratings.again });
  const toolbarBackground = screen.getByRole('button', { name: translations.en.app.name });
  expect(rating).toHaveStyle({ '--button-bg': THEME_COLORS.light.ratingAgain });
  const host = element === 'html' ? document.documentElement : document.body;
  act(() => host.classList.add(className));
  await waitFor(() => {
    expect(rating).toHaveStyle({ '--button-bg': THEME_COLORS.dark.ratingAgain });
    expect(tooltip).toHaveStyle({ backgroundColor: THEME_COLORS.dark.bgTooltip });
    expect(toolbarBackground).toHaveStyle({ '--button-bg': THEME_COLORS.dark.bgToolbarButton });
  });
  act(() => host.classList.remove(className));
  await waitFor(() => {
    expect(rating).toHaveStyle({ '--button-bg': THEME_COLORS.light.ratingAgain });
    expect(tooltip).toHaveStyle({ backgroundColor: THEME_COLORS.light.bgTooltip });
    expect(toolbarBackground).toHaveStyle({ '--button-bg': THEME_COLORS.light.bgToolbarButton });
  });
});

it('disconnects theme observers on unmount', () => {
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const { unmount } = render(<LeetSrsButton t={translations.en} onClick={vi.fn()} />);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});

describe('theme utilities', () => {
  describe('isDarkMode', () => {
    it.each([
      [false, false],
      [true, true],
    ])('should return %s when dark mode is %s', (expected, dark) => {
      document.documentElement.classList.toggle('dark', dark);
      expect(isDarkMode()).toBe(expected);
    });
  });

  describe('getRatingColor', () => {
    it.each([
      ['again', false, '#c73e3e', '#b13636'],
      ['again', true, '#d14358', '#c13a4f'],
      ['hard', false, '#d97706', '#c26805'],
      ['good', false, '#4271c4', '#3862b5'],
      ['easy', false, '#3d9156', '#35804a'],
    ] as const)('should return the %s colors when dark mode is %s', (rating, dark, bg, hover) => {
      document.documentElement.classList.toggle('dark', dark);
      expect(getRatingColor(rating)).toEqual({ bg, hover });
    });

    it('should throw error for unknown color class', () => {
      // Since getRatingColor expects a valid key of RATING_COLORS,
      // it would throw an error for unknown keys
      expect(() => getRatingColor('unknown-class' as keyof typeof RATING_COLORS)).toThrow();
    });
  });
});
