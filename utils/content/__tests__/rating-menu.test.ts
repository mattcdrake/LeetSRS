import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RatingMenu } from '../rating-menu';
import { RATING_BUTTONS } from '../constants';

// @vitest-environment happy-dom

describe('RatingMenu', () => {
  let container: HTMLElement;
  let onRate: ReturnType<typeof vi.fn>;
  let onAddWithoutRating: ReturnType<typeof vi.fn>;
  let menu: RatingMenu;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    onRate = vi.fn();
    onAddWithoutRating = vi.fn();
    menu = new RatingMenu(container, onRate, onAddWithoutRating);
  });

  afterEach(() => {
    menu.hide();
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  describe('toggle', () => {
    it('should show menu when hidden', () => {
      menu.toggle();
      expect(container.querySelector('[style*="position: absolute"]')).toBeTruthy();
    });

    it('should hide menu when visible', () => {
      menu.show();
      menu.toggle();
      expect(container.querySelector('[style*="position: absolute"]')).toBeFalsy();
    });
  });

  describe('show', () => {
    it('should create menu element with correct structure', () => {
      menu.show();

      const menuElement = container.querySelector('[style*="position: absolute"]');
      expect(menuElement).toBeTruthy();

      // Check rating buttons
      const buttons = menuElement!.querySelectorAll('button');
      expect(buttons.length).toBe(5); // 4 rating buttons + 1 add without rating

      // Verify rating buttons text
      RATING_BUTTONS.forEach((btn, index) => {
        expect(buttons[index].textContent).toBe(btn.label);
      });

      // Verify add without rating button
      expect(buttons[4].innerHTML).toContain('Add to SRS (no rating)');
    });

    it('should not create duplicate menus', () => {
      menu.show();
      menu.show();

      const menus = container.querySelectorAll('[style*="position: absolute"]');
      expect(menus.length).toBe(1);
    });

    it('should set container position to relative', () => {
      menu.show();
      expect(container.style.position).toBe('relative');
    });
  });

  describe('rating button clicks', () => {
    it('should call onRate with correct rating and label when rating button clicked', () => {
      menu.show();
      const buttons = container.querySelectorAll('button');

      // Click "Good" button (index 2)
      buttons[2].click();

      expect(onRate).toHaveBeenCalledWith(3, 'Good');
      expect(onRate).toHaveBeenCalledTimes(1);
    });

    it('should hide menu after rating button click', () => {
      menu.show();
      const buttons = container.querySelectorAll('button');

      buttons[0].click();

      expect(container.querySelector('[style*="position: absolute"]')).toBeFalsy();
    });

    it('should handle all rating buttons correctly', () => {
      RATING_BUTTONS.forEach((ratingBtn, index) => {
        menu.show();
        const buttons = container.querySelectorAll('button');
        buttons[index].click();

        expect(onRate).toHaveBeenCalledWith(ratingBtn.rating, ratingBtn.label);
        menu.hide();
      });

      expect(onRate).toHaveBeenCalledTimes(RATING_BUTTONS.length);
    });
  });

  describe('add without rating button', () => {
    it('should call onAddWithoutRating when clicked', () => {
      menu.show();
      const buttons = container.querySelectorAll('button');
      const addButton = buttons[buttons.length - 1];

      addButton.click();

      expect(onAddWithoutRating).toHaveBeenCalledTimes(1);
    });

    it('should hide menu after add without rating click', () => {
      menu.show();
      const buttons = container.querySelectorAll('button');
      const addButton = buttons[buttons.length - 1];

      addButton.click();

      expect(container.querySelector('[style*="position: absolute"]')).toBeFalsy();
    });
  });

  describe('outside click handling', () => {
    it('should hide menu when clicking outside', async () => {
      menu.show();

      // Wait for event listener to be attached
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Click outside
      document.body.click();

      expect(container.querySelector('[style*="position: absolute"]')).toBeFalsy();
    });

    it('should not hide menu when clicking inside', async () => {
      menu.show();

      // Wait for event listener to be attached
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Click inside menu
      const menuElement = container.querySelector('[style*="position: absolute"]');
      menuElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(container.querySelector('[style*="position: absolute"]')).toBeTruthy();
    });
  });

  describe('hover effects', () => {
    it('should change button background on hover', () => {
      menu.show();
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
