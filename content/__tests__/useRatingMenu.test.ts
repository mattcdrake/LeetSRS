// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { type Translations, translations } from '@/i18n';
import { createDeferred } from '@/test/utils/deferred';
import { useRatingMenu } from '../useRatingMenu';

function setup() {
  const requests: ReturnType<typeof createDeferred<Translations>>[] = [];
  const onError = vi.fn();
  const { result, unmount } = renderHook(() =>
    useRatingMenu(() => {
      const request = createDeferred<Translations>();
      requests.push(request);
      return request.promise;
    }, onError)
  );
  return { result, unmount, requests, onError };
}

it('opens with loaded translations, closes, and reloads on reopen', async () => {
  const { result, requests } = setup();
  act(() => {
    void result.current.toggle();
  });
  await act(async () => requests[0].resolve(translations.en));
  expect(result.current.translations).toBe(translations.en);
  await act(() => result.current.toggle());
  expect(result.current.translations).toBeNull();
  act(() => {
    void result.current.toggle();
  });
  await act(async () => requests[1].resolve(translations.pl));
  expect(result.current.translations).toBe(translations.pl);
});

it.each([true, false])('honors rapid toggles when the stale request resolves first: %s', async (staleFirst) => {
  const { result, requests } = setup();
  act(() => {
    void result.current.toggle();
    void result.current.toggle();
    void result.current.toggle();
  });
  if (staleFirst) {
    await act(async () => requests[0].resolve(translations.en));
    expect(result.current.translations).toBeNull();
  }
  await act(async () => requests[1].resolve(translations.pl));
  if (!staleFirst) await act(async () => requests[0].resolve(translations.en));
  expect(result.current.translations).toBe(translations.pl);
});

it('cancels a pending open on dismissal', async () => {
  const { result, requests } = setup();
  act(() => {
    void result.current.toggle();
    result.current.close();
  });
  await act(async () => requests[0].resolve(translations.en));
  expect(result.current.translations).toBeNull();
});

it('reports current errors and permits retry', async () => {
  const { result, requests, onError } = setup();
  const error = new Error('translations failed');
  act(() => {
    void result.current.toggle();
  });
  await act(async () => requests[0].reject(error));
  expect(onError).toHaveBeenCalledWith(error);
  act(() => {
    void result.current.toggle();
  });
  await act(async () => requests[1].resolve(translations.en));
  expect(result.current.translations).toBe(translations.en);
});

it('ignores stale failures', async () => {
  const { result, requests, onError } = setup();
  act(() => {
    void result.current.toggle();
    void result.current.toggle();
    void result.current.toggle();
  });
  await act(async () => requests[0].reject(new Error('stale')));
  expect(onError).not.toHaveBeenCalled();
  await act(async () => requests[1].resolve(translations.pl));
  expect(result.current.translations).toBe(translations.pl);
});

it.each([true, false])('invalidates pending requests on unmount (failure: %s)', async (failure) => {
  const { result, requests, onError, unmount } = setup();
  act(() => {
    void result.current.toggle();
  });
  unmount();
  await act(async () => {
    if (failure) requests[0].reject(new Error('late'));
    else requests[0].resolve(translations.en);
  });
  expect(result.current.translations).toBeNull();
  expect(onError).not.toHaveBeenCalled();
});
