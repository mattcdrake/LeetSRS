import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

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

afterEach(() => {
  cleanup();
});
