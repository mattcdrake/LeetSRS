import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Tooltip } from './tooltip';

// @vitest-environment happy-dom

describe('Tooltip', () => {
  let tooltip: Tooltip;

  beforeEach(() => {
    vi.useFakeTimers();
    tooltip = new Tooltip();
  });

  afterEach(() => {
    tooltip.hide();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('show', () => {
    it('should create tooltip element after delay', () => {
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);

      tooltip.show(anchor, 'Test tooltip');

      // Tooltip should not be visible immediately
      expect(document.querySelector('.z-50')).toBeFalsy();

      // Fast forward past the delay
      vi.advanceTimersByTime(300);

      // Tooltip should now be visible
      const tooltipElement = document.querySelector('.z-50');
      expect(tooltipElement).toBeTruthy();
      expect(tooltipElement!.textContent).toBe('Test tooltip');

      document.body.removeChild(anchor);
    });

    it('should position tooltip above anchor element', () => {
      const anchor = document.createElement('div');
      anchor.style.position = 'absolute';
      anchor.style.top = '100px';
      anchor.style.left = '100px';
      anchor.style.width = '50px';
      anchor.style.height = '20px';
      document.body.appendChild(anchor);

      // Mock getBoundingClientRect
      anchor.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 100,
        top: 100,
        width: 50,
        height: 20,
        right: 150,
        bottom: 120,
        x: 100,
        y: 100,
      });

      tooltip.show(anchor, 'Test');
      vi.advanceTimersByTime(300);

      const tooltipElement = document.querySelector('.z-50') as HTMLElement;
      expect(tooltipElement.style.left).toBe('125px'); // Centered: 100 + 25
      expect(tooltipElement.style.top).toBe('128px'); // Below anchor with 8px gap (100 + 20 + 8)

      document.body.removeChild(anchor);
    });

    it('should cancel show if hide is called before timeout', () => {
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);

      tooltip.show(anchor, 'Test tooltip');
      tooltip.hide();

      vi.advanceTimersByTime(300);

      // Tooltip should not appear
      expect(document.querySelector('.z-50')).toBeFalsy();

      document.body.removeChild(anchor);
    });

    it('should update existing tooltip if show is called again', () => {
      const anchor1 = document.createElement('div');
      const anchor2 = document.createElement('div');
      document.body.appendChild(anchor1);
      document.body.appendChild(anchor2);

      // Show first tooltip
      tooltip.show(anchor1, 'First tooltip');
      vi.advanceTimersByTime(300);

      let tooltipElement = document.querySelector('.z-50');
      expect(tooltipElement!.textContent).toBe('First tooltip');

      // Show second tooltip
      tooltip.show(anchor2, 'Second tooltip');
      vi.advanceTimersByTime(300);

      // Should still only have one tooltip
      const tooltips = document.querySelectorAll('.z-50');
      expect(tooltips.length).toBe(1);
      expect(tooltips[0].textContent).toBe('Second tooltip');

      document.body.removeChild(anchor1);
      document.body.removeChild(anchor2);
    });
  });

  describe('hide', () => {
    it('should remove tooltip element', () => {
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);

      tooltip.show(anchor, 'Test tooltip');
      vi.advanceTimersByTime(300);

      expect(document.querySelector('.z-50')).toBeTruthy();

      tooltip.hide();

      expect(document.querySelector('.z-50')).toBeFalsy();

      document.body.removeChild(anchor);
    });

    it('should clear timeout if tooltip not yet shown', () => {
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);

      tooltip.show(anchor, 'Test tooltip');

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      tooltip.hide();

      expect(clearTimeoutSpy).toHaveBeenCalled();

      document.body.removeChild(anchor);
    });
  });

  describe('styling', () => {
    it('should apply correct styles to tooltip', () => {
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);

      tooltip.show(anchor, 'Test tooltip');
      vi.advanceTimersByTime(300);

      const tooltipElement = document.querySelector('.z-50') as HTMLElement;

      expect(tooltipElement.style.position).toBe('fixed');
      expect(tooltipElement.style.backgroundColor).toBe('white'); // Light mode default
      expect(tooltipElement.style.color).toBe('#374151');
      expect(tooltipElement.style.border).toBe('1px solid rgba(0, 0, 0, 0.08)');
      expect(tooltipElement.style.pointerEvents).toBe('none');
      expect(tooltipElement.style.zIndex).toBe('50');
      // Opacity will be 0 initially, then animated to 1
      expect(tooltipElement.style.opacity).toBe('0');

      document.body.removeChild(anchor);
    });
  });
});
