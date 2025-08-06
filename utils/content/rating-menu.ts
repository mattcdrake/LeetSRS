import { RATING_BUTTONS, THEME_COLORS } from './constants';
import { getRatingColor, isDarkMode } from './theme';
import { createButton } from './button';

export type RatingCallback = (rating: number, label: string) => void;

export class RatingMenu {
  private element: HTMLDivElement | null = null;
  private container: HTMLElement;
  private onRate: RatingCallback;
  private onAddWithoutRating: () => void;

  constructor(container: HTMLElement, onRate: RatingCallback, onAddWithoutRating: () => void) {
    this.container = container;
    this.onRate = onRate;
    this.onAddWithoutRating = onAddWithoutRating;
  }

  toggle(): void {
    if (this.element) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    if (this.element) return;

    this.element = document.createElement('div');
    const isDark = isDarkMode();
    const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

    this.element.style.cssText = `
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
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

    // Create rating buttons container
    const ratingButtonsContainer = document.createElement('div');
    ratingButtonsContainer.style.cssText = `
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    `;

    // Create rating buttons
    RATING_BUTTONS.forEach(({ rating, label, colorKey }) => {
      const { bg, hover } = getRatingColor(colorKey);

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
          this.onRate(rating, label);
          this.hide();
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

    this.element.appendChild(ratingButtonsContainer);

    // Add "Add without rating" button
    const addButton = this.createAddWithoutRatingButton();
    this.element.appendChild(addButton);

    // Add menu to container
    this.container.style.position = 'relative';
    this.container.appendChild(this.element);

    // Setup close on outside click
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 0);
  }

  private createAddWithoutRatingButton(): HTMLButtonElement {
    const isDark = isDarkMode();
    const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
    const bgColor = colors.bgAddButton;
    const hoverBgColor = colors.bgAddButtonHover;
    const textColor = colors.textAddButton;

    const button = createButton({
      style: `
        width: 100%;
        padding: 6px 12px;
        border-radius: 4px;
        background-color: ${bgColor};
        color: ${textColor};
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
        this.onAddWithoutRating();
        this.hide();
      },
    });

    button.innerHTML = `<span style="filter: grayscale(1) brightness(${isDark ? '2' : '0.3'});">➕</span> Add to SRS (no rating)`;

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = hoverBgColor;
      button.style.textDecoration = 'underline';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = bgColor;
      button.style.textDecoration = 'none';
    });

    return button;
  }

  hide(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
      document.removeEventListener('click', this.handleOutsideClick);
    }
  }

  private handleOutsideClick = (e: MouseEvent): void => {
    if (!this.container.contains(e.target as Node)) {
      this.hide();
    }
  };
}
