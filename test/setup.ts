import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { testCatalog } from '@/test/utils/catalog-mocks';

// The fake browser serializes writes, but shares stored objects on reads.
// Browser storage returns snapshots; keep that behavior across mock resets.
for (const area of ['local', 'sync', 'session', 'managed'] as const) {
  const storage = fakeBrowser.storage[area];
  storage.get = new Proxy(storage.get, {
    apply(get, context, args: unknown[]) {
      const result: unknown = Reflect.apply(get, context, args);
      return result instanceof Promise ? result.then((items) => structuredClone(items)) : result;
    },
  });
}

beforeEach(() => {
  vi.spyOn(browser.permissions.onAdded, 'addListener').mockImplementation(() => {});
  const fetchFromNetwork = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    for (const [file, key] of [
      ['id', 'frontendId'],
      ['slug', 'slug'],
    ] as const) {
      if (input === browser.runtime.getURL(`/data/leetcode-catalog-by-${file}.json`)) {
        return Response.json(Object.fromEntries(testCatalog.map((problem) => [problem[key], problem])));
      }
    }
    return fetchFromNetwork(input, init);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
