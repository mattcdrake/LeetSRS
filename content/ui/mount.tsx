import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Translations } from '@/i18n';
import { LeetSrsButton } from './LeetSrsButton';
import { type RatingCallback, type RatingMenuPosition, RatingMenu as RatingMenuView } from './RatingMenu';
import { Tooltip as TooltipView } from './Tooltip';

type MountedUi = { element: HTMLDivElement; unmount: () => void };

// Temporary bridge for the synchronous bootstrap/coordinator API until the WXT UI mount migration.
function mountUi(container: HTMLElement | null, view: ReactNode): MountedUi {
  const element = document.createElement('div');
  container?.appendChild(element);
  const root = createRoot(element);
  flushSync(() => root.render(view));
  return {
    element,
    unmount: () => {
      root.unmount();
      element.remove();
    },
  };
}

export function mountLeetSrsButton(onClick: () => void, t: Translations): MountedUi {
  const mounted = mountUi(null, <LeetSrsButton onClick={onClick} t={t} />);
  mounted.element.className = 'relative flex';
  return mounted;
}

type RatingMenuOptions = { position?: RatingMenuPosition };

export class RatingMenu {
  private mounted: MountedUi | null = null;
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

  show(t: Translations): void {
    if (this.mounted) return;

    this.container.style.position = 'relative';
    this.mounted = mountUi(
      this.container,
      <RatingMenuView
        t={t}
        position={this.position}
        onRate={this.onRate}
        onAddWithoutRating={this.onAddWithoutRating}
        onSelect={() => this.hide()}
      />
    );

    document.addEventListener('click', this.handleOutsideClick);
  }

  hide(): void {
    if (this.mounted) {
      this.mounted.unmount();
      this.mounted = null;
      document.removeEventListener('click', this.handleOutsideClick);
    }
  }

  isVisible(): boolean {
    return this.mounted !== null;
  }

  private handleOutsideClick = (e: MouseEvent): void => {
    if (!e.composedPath().includes(this.container)) {
      this.hide();
    }
  };
}

export class Tooltip {
  private mounted: MountedUi | null = null;

  show(target: HTMLElement, text: string, delay = 300): void {
    this.hide();
    this.mounted = mountUi(document.body, <TooltipView target={target} text={text} delay={delay} />);
  }

  hide(): void {
    this.mounted?.unmount();
    this.mounted = null;
  }
}
