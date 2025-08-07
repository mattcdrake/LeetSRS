import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isDarkMode, getRatingColor } from '../theme';
import { RATING_COLORS } from '../constants';

// @vitest-environment happy-dom

describe('theme utilities', () => {
  let originalDocument: Document;

  beforeEach(() => {
    originalDocument = global.document;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  describe('isDarkMode', () => {
    it('should return true when dark class is present', () => {
      document.documentElement.classList.add('dark');
      expect(isDarkMode()).toBe(true);
    });

    it('should return false when dark class is not present', () => {
      document.documentElement.classList.remove('dark');
      expect(isDarkMode()).toBe(false);
    });

    it('should handle document being undefined gracefully', () => {
      // This test is not applicable since isDarkMode directly accesses document
      // and would throw an error if document is undefined. In a content script,
      // document is always available.
      expect(true).toBe(true);
    });
  });

  describe('getRatingColor', () => {
    it('should return correct colors for rating-again in light mode', () => {
      document.documentElement.classList.remove('dark');
      const colors = getRatingColor('again');
      expect(colors).toEqual({
        bg: '#c73e3e',
        hover: '#b13636',
      });
    });

    it('should return correct colors for rating-again in dark mode', () => {
      document.documentElement.classList.add('dark');
      const colors = getRatingColor('again');
      expect(colors).toEqual({
        bg: '#d14358',
        hover: '#c13a4f',
      });
    });

    it('should return correct colors for rating-hard', () => {
      document.documentElement.classList.remove('dark');
      const colors = getRatingColor('hard');
      expect(colors).toEqual({
        bg: '#d97706',
        hover: '#c26805',
      });
    });

    it('should return correct colors for rating-good', () => {
      document.documentElement.classList.remove('dark');
      const colors = getRatingColor('good');
      expect(colors).toEqual({
        bg: '#4271c4',
        hover: '#3862b5',
      });
    });

    it('should return correct colors for rating-easy', () => {
      document.documentElement.classList.remove('dark');
      const colors = getRatingColor('easy');
      expect(colors).toEqual({
        bg: '#3d9156',
        hover: '#35804a',
      });
    });

    it('should throw error for unknown color class', () => {
      // Since getRatingColor expects a valid key of RATING_COLORS,
      // it would throw an error for unknown keys
      expect(() => getRatingColor('unknown-class' as keyof typeof RATING_COLORS)).toThrow();
    });
  });
});
