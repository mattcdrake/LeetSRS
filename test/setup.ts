import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
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
      const snapshotArgs = args.map((arg) =>
        typeof arg === 'function' ? (items: unknown) => arg(structuredClone(items)) : arg
      );
      const result: unknown = Reflect.apply(get, context, snapshotArgs);
      return result instanceof Promise ? result.then((items) => structuredClone(items)) : result;
    },
  });
}

beforeEach(() => {
  vi.spyOn(browser.permissions.onAdded, 'addListener').mockImplementation(() => {});
  vi.stubGlobal('indexedDB', new IDBFactory());
  const fetchFromNetwork = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (input === browser.runtime.getURL('/data/leetcode-catalog.sha256')) return new Response('test-hash');
    if (input === browser.runtime.getURL('/data/leetcode-catalog.json')) return Response.json(testCatalog);
    return fetchFromNetwork(input, init);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
