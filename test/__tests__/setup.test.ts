import { beforeEach, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

beforeEach(() => fakeBrowser.reset());

it('fake storage isolates saved values and promise read results until an explicit write', async () => {
  const storage = fakeBrowser.storage.local;
  const input = { record: { name: 'Saved', nested: { value: 1 } } };
  const saved = structuredClone(input);
  await storage.set(input);

  input.record.name = 'Unsaved input change';
  input.record.nested.value = 2;
  const retrieved = await storage.get<typeof input>('record');
  expect(retrieved).toEqual(saved);

  retrieved.record.name = 'Unsaved read change';
  retrieved.record.nested.value = 3;
  expect(await storage.get('record')).toEqual(saved);

  await storage.set(retrieved);
  expect(await storage.get('record')).toEqual(retrieved);
});
