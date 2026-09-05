import type { Translations } from '@/shared/i18n';
import { createButton } from './button';
import { RATING_BUTTON_CONFIGS, THEME_COLORS } from './constants';
import { getRatingColor, isDarkMode } from './theme';

export type RatingCallback = (rating: number, label: string) => void;
type RatingMenuPosition = 'top' | 'bottom';
type RatingMenuOptions = {
  position?: RatingMenuPosition;
};

type RatingMenuElementOptions = {
  t: Translations;
  position: RatingMenuPosition;
  onRate: RatingCallback;
  onAddWithoutRating: () => void;
  onSelect: () => void;
};

export class RatingMenu {
  private element: HTMLDivElement | null = null;
  private container: HTMLElement;
  private onRate: RatingCallback;
  private onAddWithoutRating: () => void;
  private position: RatingMenuPosition;

  constructor(
    container: HTMLElement,
    onRate: RatingCallback,
    onAddWithoutRating: () => void,
    options?: RatingMenuOptions
  ) {
    this.container = container;
    this.onRate = onRate;
    this.onAddWithoutRating = onAddWithoutRating;
    this.position = options?.position ?? 'bottom';
  }

  toggle(t: Translations): void {
    if (this.element) {
      this.hide();
    } else {
      this.show(t);
    }
  }

  show(t: Translations): void {
    if (this.element) return;

    this.element = createRatingMenuElement({
      t,
      position: this.position,
      onRate: this.onRate,
      onAddWithoutRating: this.onAddWithoutRating,
      onSelect: () => this.hide(),
    });

    this.container.style.position = 'relative';
    this.container.appendChild(this.element);

    document.addEventListener('click', this.handleOutsideClick);
  }

  hide(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
      document.removeEventListener('click', this.handleOutsideClick);
    }
  }

  isVisible(): boolean {
    return this.element !== null;
  }

  private handleOutsideClick = (e: MouseEvent): void => {
    if (!this.container.contains(e.target as Node)) {
      this.hide();
    }
  };
}

function createRatingMenuElement(options: RatingMenuElementOptions): HTMLDivElement {
  const element = document.createElement('div');
  const isDark = isDarkMode();
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  const positionStyles =
    options.position === 'top' ? 'bottom: 100%; margin-bottom: 8px;' : 'top: 100%; margin-top: 8px;';

  element.style.cssText = `
    position: absolute;
    right: 0;
    ${positionStyles}
    min-width: 160px;
    background-color: ${colors.bgSecondary};
    border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.15)'};
    border-radius: 8px;
    padding: 12px;
    box-shadow: ${
      isDark
        ? '0 8px 16px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3)'
        : '0 8px 16px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1)'
    };
    z-index: 50;
  `;

  const ratingButtonsContainer = document.createElement('div');
  ratingButtonsContainer.style.cssText = `
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  `;

  RATING_BUTTON_CONFIGS.forEach(({ rating, labelKey, colorKey }) => {
    const { bg, hover } = getRatingColor(colorKey);
    const label = options.t.ratings[labelKey];
    const button = createButton({
      style: `
        width: 64px;
        padding: 8px 8px;
        border-radius: 4px;
        background-color: ${bg};
        color: white;
        font-size: 13px;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s;
        height: 32px;
      `,
      onClick: () => {
        options.onRate(rating, label);
        options.onSelect();
      },
    });

    button.textContent = label;
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = hover;
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = bg;
    });
    ratingButtonsContainer.appendChild(button);
  });

  element.appendChild(ratingButtonsContainer);
  element.appendChild(createAddWithoutRatingButton(options, isDark));
  return element;
}

function createAddWithoutRatingButton(options: RatingMenuElementOptions, isDark: boolean): HTMLButtonElement {
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  const button = createButton({
    style: `
      width: 100%;
      padding: 6px 12px;
      border-radius: 4px;
      background-color: ${colors.bgAddButton};
      color: ${colors.textAddButton};
      font-size: 13px;
      border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
      cursor: pointer;
      transition: all 0.2s;
      display: block;
      text-decoration: none;
      height: 32px;
      line-height: 20px;
    `,
    onClick: () => {
      options.onAddWithoutRating();
      options.onSelect();
    },
  });

  button.innerHTML = `<span style="filter: grayscale(1) brightness(${isDark ? '2' : '0.3'});">➕</span> ${options.t.contentScript.addToSrsNoRating}`;
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = colors.bgAddButtonHover;
    button.style.textDecoration = 'underline';
  });
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = colors.bgAddButton;
    button.style.textDecoration = 'none';
  });
  return button;
}
