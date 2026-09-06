import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Translations, translations } from '@/shared/i18n';
import { createDeferred, type Deferred } from '@/test/utils/deferred';
import { type CoordinatedRatingMenu, RatingMenuCoordinator } from '../rating-menu-coordinator';

describe('RatingMenuCoordinator', () => {
  let visible: boolean;
  let menu: CoordinatedRatingMenu;
  let requests: Array<Deferred<Translations>>;
  let onError: (error: unknown) => void;
  let coordinator: RatingMenuCoordinator;

  beforeEach(() => {
    visible = false;
    requests = [];
    menu = {
      isVisible: vi.fn(() => visible),
      show: vi.fn(() => {
        visible = true;
      }),
      hide: vi.fn(() => {
        visible = false;
      }),
    };
    const getTranslations = vi.fn(() => {
      const request = createDeferred<Translations>();
      requests.push(request);
      return request.promise;
    });
    onError = vi.fn();
    coordinator = new RatingMenuCoordinator({ menu, getTranslations, onError });
  });

  it('opens with resolved translations and closes synchronously', async () => {
    const opening = coordinator.toggle();
    requests[0].resolve(translations.en);
    await opening;
    expect(menu.show).toHaveBeenCalledWith(translations.en);

    await coordinator.toggle();
    expect(menu.hide).toHaveBeenCalledOnce();
    expect(visible).toBe(false);
  });

  it('honors the latest intent across rapid open, close, and open clicks', async () => {
    const firstOpening = coordinator.toggle();
    await coordinator.toggle();
    const latestOpening = coordinator.toggle();

    requests[1].resolve(translations.pl);
    await latestOpening;
    requests[0].resolve(translations.en);
    await firstOpening;

    expect(menu.show).toHaveBeenCalledOnce();
    expect(menu.show).toHaveBeenCalledWith(translations.pl);
  });

  it('ignores a stale request that resolves before the current request', async () => {
    const staleOpening = coordinator.toggle();
    await coordinator.toggle();
    const currentOpening = coordinator.toggle();

    requests[0].resolve(translations.en);
    await staleOpening;
    expect(menu.show).not.toHaveBeenCalled();
    requests[1].resolve(translations.pl);
    await currentOpening;
    expect(menu.show).toHaveBeenCalledWith(translations.pl);
  });

  it('cancels a pending open when closed', async () => {
    const opening = coordinator.toggle();
    coordinator.close();
    requests[0].resolve(translations.en);
    await opening;

    expect(menu.show).not.toHaveBeenCalled();
    expect(menu.hide).toHaveBeenCalledOnce();
  });

  it('reports a current translation failure and permits a retry', async () => {
    const error = new Error('translation failure');
    const failedOpening = coordinator.toggle();
    requests[0].reject(error);
    await failedOpening;

    expect(onError).toHaveBeenCalledWith(error);
    expect(menu.show).not.toHaveBeenCalled();

    const retry = coordinator.toggle();
    requests[1].resolve(translations.en);
    await retry;
    expect(menu.show).toHaveBeenCalledWith(translations.en);
  });

  it('ignores failures from stale requests', async () => {
    const staleOpening = coordinator.toggle();
    await coordinator.toggle();
    const currentOpening = coordinator.toggle();

    requests[0].reject(new Error('stale failure'));
    await staleOpening;
    expect(onError).not.toHaveBeenCalled();
    requests[1].resolve(translations.en);
    await currentOpening;
    expect(menu.show).toHaveBeenCalledWith(translations.en);
  });

  it('reopens after the menu hides itself', async () => {
    const firstOpening = coordinator.toggle();
    requests[0].resolve(translations.en);
    await firstOpening;
    visible = false;

    const secondOpening = coordinator.toggle();
    requests[1].resolve(translations.pl);
    await secondOpening;

    expect(menu.show).toHaveBeenLastCalledWith(translations.pl);
    expect(menu.show).toHaveBeenCalledTimes(2);
  });
});
