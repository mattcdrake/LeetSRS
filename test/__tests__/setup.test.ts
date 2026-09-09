import { beforeEach, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

beforeEach(() => fakeBrowser.reset());

it.each(['promise', 'callback with keys', 'callback only'])(
  'fake storage isolates saved values and %s read results until an explicit write',
  async (mode) => {
    const storage = fakeBrowser.storage.local;
    const input = { record: { name: 'Saved', nested: { value: 1 } } };
    const saved = structuredClone(input);
    await storage.set(input);

    input.record.name = 'Unsaved input change';
    input.record.nested.value = 2;
    const retrieved =
      mode === 'promise'
        ? await storage.get<typeof input>('record')
        : await new Promise<typeof input>((resolve) => {
            const result =
              mode === 'callback only'
                ? storage.get<typeof input>(resolve)
                : storage.get<typeof input>('record', resolve);
            expect(result).toBeUndefined();
          });
    expect(retrieved).toEqual(saved);

    retrieved.record.name = 'Unsaved read change';
    retrieved.record.nested.value = 3;
    expect(await storage.get('record')).toEqual(saved);

    await storage.set(retrieved);
    expect(await storage.get('record')).toEqual(retrieved);
  }
);
