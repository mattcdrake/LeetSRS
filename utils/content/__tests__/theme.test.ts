import { describe, expect, it } from 'vitest';
import type { RATING_COLORS } from '../constants';
import { getRatingColor, isDarkMode } from '../theme';

// @vitest-environment happy-dom

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
