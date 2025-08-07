import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createButton, createLeetSrsButton } from '../button';
import { LEETSRS_BUTTON_COLOR } from '../constants';

// @vitest-environment happy-dom

describe('button utilities', () => {
  describe('createButton', () => {
    it('should create a button element', () => {
      const button = createButton({});
      expect(button.tagName).toBe('BUTTON');
    });

    it('should apply className when provided', () => {
      const button = createButton({ className: 'test-class' });
      expect(button.className).toBe('test-class');
    });

    it('should apply inline styles when provided', () => {
      const button = createButton({ style: 'color: red; background: blue;' });
      expect(button.style.color).toBe('red');
      expect(button.style.background).toBe('blue');
    });

    it('should set innerHTML when provided', () => {
      const button = createButton({ innerHTML: '<span>Test</span>' });
      expect(button.innerHTML).toBe('<span>Test</span>');
    });

    it('should attach click handler when provided', () => {
      const onClick = vi.fn();
      const button = createButton({ onClick });

      button.click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should handle all options together', () => {
      const onClick = vi.fn();
      const button = createButton({
        className: 'test-button',
        style: 'padding: 10px;',
        innerHTML: 'Click me',
        onClick,
      });

      expect(button.className).toBe('test-button');
      expect(button.style.padding).toBe('10px');
      expect(button.innerHTML).toBe('Click me');

      button.click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('createLeetSRSButton', () => {
    beforeEach(() => {
      // Clear any existing dark class
      document.documentElement.classList.remove('dark');
    });

    it('should create a div wrapper with correct structure', () => {
      const onClick = vi.fn();
      const button = createLeetSrsButton(onClick);

      expect(button.tagName).toBe('DIV');
      expect(button.className).toBe('relative flex');

      // Check nested structure
      const innerWrapper = button.firstElementChild;
      expect(innerWrapper?.className).toBe(
        'relative flex overflow-hidden rounded bg-fill-tertiary dark:bg-fill-tertiary'
      );

      const groupWrapper = innerWrapper?.firstElementChild;
      expect(groupWrapper?.className).toContain('group flex flex-none items-center');
    });

    it('should create clickable div with correct attributes', () => {
      const onClick = vi.fn();
      const button = createLeetSrsButton(onClick);

      const clickableDiv = button.querySelector('[data-state="closed"]');
      expect(clickableDiv).toBeTruthy();
      expect(clickableDiv?.getAttribute('title')).toBe('LeetSRS');
      expect(clickableDiv?.getAttribute('aria-label')).toBe('LeetSRS');
      expect(clickableDiv?.classList.contains('flex')).toBe(true);
      expect(clickableDiv?.classList.contains('cursor-pointer')).toBe(true);
    });

    it('should attach click handler to clickable div', () => {
      const onClick = vi.fn();
      const button = createLeetSrsButton(onClick);

      const clickableDiv = button.querySelector('[data-state="closed"]') as HTMLElement;
      clickableDiv.click();

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should include SVG icon', () => {
      const onClick = vi.fn();
      const button = createLeetSrsButton(onClick);

      const svg = button.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('width')).toBe('1em');
      expect(svg?.getAttribute('height')).toBe('1em');

      // Check for the rotate icon path
      const paths = svg?.querySelectorAll('path');
      expect(paths?.length).toBeGreaterThan(0);
    });

    it('should apply green color to clickable div', () => {
      const onClick = vi.fn();
      const button = createLeetSrsButton(onClick);

      const clickableDiv = button.querySelector('[data-state="closed"]') as HTMLElement;
      expect(clickableDiv.style.color).toBe(LEETSRS_BUTTON_COLOR);
    });

    it('should use same color for light and dark modes', () => {
      const onClick = vi.fn();

      // Test light mode
      document.documentElement.classList.remove('dark');
      const buttonLight = createLeetSrsButton(onClick);
      const clickableDivLight = buttonLight.querySelector('[data-state="closed"]') as HTMLElement;
      expect(clickableDivLight.style.color).toBe('#28c244');

      // Test dark mode
      document.documentElement.classList.add('dark');
      const buttonDark = createLeetSrsButton(onClick);
      const clickableDivDark = buttonDark.querySelector('[data-state="closed"]') as HTMLElement;
      expect(clickableDivDark.style.color).toBe('#28c244');
    });
  });
});
