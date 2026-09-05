import type { Translations } from '@/shared/i18n';

export type CoordinatedRatingMenu = {
  isVisible: () => boolean;
  show: (t: Translations) => void;
  hide: () => void;
};

type RatingMenuCoordinatorOptions = {
  menu: CoordinatedRatingMenu;
  getTranslations: () => Promise<Translations>;
  onError: (error: unknown) => void;
};

type RatingMenuState = 'closed' | 'opening' | 'open';

// Coordinates asynchronous translation loading with the rating menu's synchronous visibility operations.
export class RatingMenuCoordinator {
  private state: RatingMenuState = 'closed';
  private interactionVersion = 0;

  constructor(private readonly options: RatingMenuCoordinatorOptions) {}

  async toggle(): Promise<void> {
    this.reconcileVisibility();

    if (this.state === 'opening') {
      this.close();
      return;
    }

    if (this.state === 'open') {
      this.close();
      return;
    }

    await this.open();
  }

  close(): void {
    this.interactionVersion += 1;
    this.state = 'closed';
    this.options.menu.hide();
  }

  // Version each open attempt so only the latest unresolved interaction can show the menu or report an error.
  private async open(): Promise<void> {
    const version = ++this.interactionVersion;
    this.state = 'opening';

    try {
      const t = await this.options.getTranslations();
      if (version !== this.interactionVersion || this.state !== 'opening') return;

      this.options.menu.show(t);
      this.state = 'open';
    } catch (error) {
      if (version !== this.interactionVersion || this.state !== 'opening') return;

      this.state = 'closed';
      this.options.onError(error);
    }
  }

  private reconcileVisibility(): void {
    if (this.state === 'open' && !this.options.menu.isVisible()) {
      this.state = 'closed';
    }
  }
}
