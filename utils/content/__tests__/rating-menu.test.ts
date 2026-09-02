import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translations } from '@/shared/i18n';
import { requireDefined } from '@/test/utils/assertions';
import { RATING_BUTTON_CONFIGS } from '../constants';
import { type RatingCallback, RatingMenu } from '../rating-menu';

// @vitest-environment happy-dom

// Get the labels from translations for testing
const t = translations.en;
const RATING_BUTTONS = RATING_BUTTON_CONFIGS.map((config) => ({
  ...config,
  label: t.ratings[config.labelKey],
}));

describe('RatingMenu', () => {
  let container: HTMLElement;
  let onRate: RatingCallback;
  let onAddWithoutRating: () => void;
  let menu: RatingMenu;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    onRate = vi.fn<RatingCallback>();
    onAddWithoutRating = vi.fn<() => void>();
    menu = new RatingMenu(container, onRate, onAddWithoutRating, async () => t);
  });

  afterEach(() => {
    menu.hide();
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  describe('toggle', () => {
    it('should show menu when hidden', async () => {
      await menu.toggle();
      expect(container.querySelector('[style*="position: absolute"]')).toBeTruthy();
    });

    it('should hide menu when visible', async () => {
      await menu.show();
      await menu.toggle();
      expect(container.querySelector('[style*="position: absolute"]')).toBeFalsy();
    });
  });

  describe('show', () => {
    it('should create menu element with correct structure', async () => {
      await menu.show();

      const menuElement = container.querySelector('[style*="position: absolute"]');
      expect(menuElement).toBeTruthy();

      // Check rating buttons
      const buttons = requireDefined(menuElement).querySelectorAll('button');
      expect(buttons.length).toBe(5); // 4 rating buttons + 1 add without rating

      // Verify rating buttons text
      RATING_BUTTONS.forEach((btn, index) => {
        expect(buttons[index].textContent).toBe(btn.label);
      });

      // Verify add without rating button
      expect(buttons[4].innerHTML).toContain('Add to SRS (no rating)');
    });

    it('should not create duplicate menus', async () => {
      await menu.show();
      await menu.show();

      const menus = container.querySelectorAll('[style*="position: absolute"]');
      expect(menus.length).toBe(1);
    });

    it('should set container position to relative', async () => {
      await menu.show();
      expect(container.style.position).toBe('relative');
    });

    it('should use the current translations each time it opens', async () => {
      let currentTranslations = translations.en;
      menu = new RatingMenu(container, onRate, onAddWithoutRating, async () => currentTranslations);

      await menu.show();
      expect(container.querySelectorAll('button')[2].textContent).toBe(translations.en.ratings.good);

      menu.hide();
      currentTranslations = translations.pl;
      await menu.show();
      expect(container.querySelectorAll('button')[2].textContent).toBe(translations.pl.ratings.good);
    });
  });

  describe('rating button clicks', () => {
    it('should call onRate with correct rating and label when rating button clicked', async () => {
      await menu.show();
      const buttons = container.querySelectorAll('button');

      // Click "Good" button (index 2)
      buttons[2].click();

      expect(onRate).toHaveBeenCalledWith(3, 'Good');
      expect(onRate).toHaveBeenCalledTimes(1);
    });

    it('should hide menu after rating button click', async () => {
      await menu.show();
      const buttons = container.querySelectorAll('button');

      buttons[0].click();

      expect(container.querySelector('[style*="position: absolute"]')).toBeFalsy();
    });

    it('should handle all rating buttons correctly', async () => {
      for (const [index, ratingBtn] of RATING_BUTTONS.entries()) {
        await menu.show();
        const buttons = container.querySelectorAll('button');
        buttons[index].click();

        expect(onRate).toHaveBeenCalledWith(ratingBtn.rating, ratingBtn.label);
        menu.hide();
      }

      expect(onRate).toHaveBeenCalledTimes(RATING_BUTTONS.length);
    });
  });

  describe('add without rating button', () => {
    it('should call onAddWithoutRating when clicked', async () => {
      await menu.show();
      const buttons = container.querySelectorAll('button');
      const addButton = buttons[buttons.length - 1];

      addButton.click();

      expect(onAddWithoutRating).toHaveBeenCalledTimes(1);
    });

    it('should hide menu after add without rating click', async () => {
      await menu.show();
      const buttons = container.querySelectorAll('button');
      const addButton = buttons[buttons.length - 1];

      addButton.click();

      expect(container.querySelector('[style*="position: absolute"]')).toBeFalsy();
    });
  });

  describe('outside click handling', () => {
    it('should hide menu when clicking outside', async () => {
      await menu.show();

      // Wait for event listener to be attached
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Click outside
      document.body.click();

      expect(container.querySelector('[style*="position: absolute"]')).toBeFalsy();
    });

    it('should not hide menu when clicking inside', async () => {
      await menu.show();

      // Wait for event listener to be attached
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Click inside menu
      const menuElement = container.querySelector('[style*="position: absolute"]');
      requireDefined(menuElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(container.querySelector('[style*="position: absolute"]')).toBeTruthy();
    });
  });

  describe('hover effects', () => {
    it('should change button background on hover', async () => {
      await menu.show();
      const buttons = container.querySelectorAll('button');
      const button = buttons[0];
      const originalBg = button.style.backgroundColor;

      button.dispatchEvent(new MouseEvent('mouseenter'));
      const hoverBg = button.style.backgroundColor;

      expect(hoverBg).not.toBe(originalBg);

      button.dispatchEvent(new MouseEvent('mouseleave'));
      expect(button.style.backgroundColor).toBe(originalBg);
    });
  });
});
