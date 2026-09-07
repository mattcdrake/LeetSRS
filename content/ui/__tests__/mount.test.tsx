import { act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translations } from '@/i18n';
import { requireDefined } from '@/test/utils/assertions';
import { RATING_BUTTON_CONFIGS } from '../constants';
import { RatingMenu } from '../mount';
import type { RatingCallback } from '../RatingMenu';

// @vitest-environment happy-dom

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
    menu = new RatingMenu(container, onRate, onAddWithoutRating);
  });

  afterEach(() => {
    act(() => menu.hide());
    container.remove();
    vi.clearAllMocks();
  });

  function getButtons(): NodeListOf<HTMLButtonElement> {
    return container.querySelectorAll('button');
  }

  it('shows and hides synchronously without creating duplicate menus', () => {
    expect(menu.isVisible()).toBe(false);
    act(() => menu.show(t));
    act(() => menu.show(t));
    expect(menu.isVisible()).toBe(true);
    expect(container.querySelectorAll('[style*="position: absolute"]')).toHaveLength(1);

    act(() => menu.hide());
    expect(menu.isVisible()).toBe(false);
  });

  it('renders buttons using the provided translations', () => {
    act(() => menu.show(t));
    const buttons = getButtons();

    expect(buttons).toHaveLength(5);
    RATING_BUTTONS.forEach((button, index) => {
      expect(buttons[index].textContent).toBe(button.label);
    });
    expect(buttons[4].textContent).toContain(t.contentScript.addToSrsNoRating);
  });

  it('uses newly provided translations when reopened', () => {
    act(() => menu.show(translations.en));
    expect(getButtons()[2].textContent).toBe(translations.en.ratings.good);
    act(() => menu.hide());

    act(() => menu.show(translations.pl));
    expect(getButtons()[2].textContent).toBe(translations.pl.ratings.good);
  });

  it('positions the menu below its relatively positioned container by default', () => {
    act(() => menu.show(t));
    const element = requireDefined(container.querySelector<HTMLElement>('[style*="position: absolute"]'));

    expect(container.style.position).toBe('relative');
    expect(element.style.top).toBe('100%');
    expect(element.style.marginTop).toBe('8px');
  });

  it('supports positioning the menu above its container', () => {
    menu = new RatingMenu(container, onRate, onAddWithoutRating, { position: 'top' });
    act(() => menu.show(t));
    const element = requireDefined(container.querySelector<HTMLElement>('[style*="position: absolute"]'));

    expect(element.style.bottom).toBe('100%');
    expect(element.style.marginBottom).toBe('8px');
  });

  it('rates with each configured value and translated label, then hides', () => {
    RATING_BUTTONS.forEach((ratingButton, index) => {
      act(() => menu.show(t));
      fireEvent.click(getButtons()[index]);
      expect(onRate).toHaveBeenLastCalledWith(ratingButton.rating, ratingButton.label);
      expect(menu.isVisible()).toBe(false);
    });
    expect(onRate).toHaveBeenCalledTimes(RATING_BUTTONS.length);
  });

  it('adds without a rating, then hides', () => {
    act(() => menu.show(t));
    fireEvent.click(getButtons()[4]);

    expect(onAddWithoutRating).toHaveBeenCalledOnce();
    expect(menu.isVisible()).toBe(false);
  });

  it('hides after an outside click but remains open after an inside click', () => {
    act(() => menu.show(t));
    const element = requireDefined(container.querySelector<HTMLElement>('[style*="position: absolute"]'));

    fireEvent.click(element);
    expect(menu.isVisible()).toBe(true);
    fireEvent.click(document.body);
    expect(menu.isVisible()).toBe(false);
  });

  it('applies and restores rating-button hover colors', () => {
    act(() => menu.show(t));
    const button = getButtons()[0];
    const originalBackground = button.style.backgroundColor;

    fireEvent.mouseEnter(button);
    expect(button.style.backgroundColor).not.toBe(originalBackground);
    fireEvent.mouseLeave(button);
    expect(button.style.backgroundColor).toBe(originalBackground);
  });

  it('applies and restores add-button hover styles', () => {
    act(() => menu.show(t));
    const button = getButtons()[4];
    const originalBackground = button.style.backgroundColor;

    fireEvent.mouseEnter(button);
    expect(button.style.backgroundColor).not.toBe(originalBackground);
    expect(button.style.textDecoration).toBe('underline');
    fireEvent.mouseLeave(button);
    expect(button.style.backgroundColor).toBe(originalBackground);
    expect(button.style.textDecoration).toBe('none');
  });
});
