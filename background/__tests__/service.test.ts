import { beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/background/startup';
import { background } from '@/shared/background-service';
import { readLearningDocument } from '@/shared/storage';
import { testCatalog } from '@/test/utils/catalog-mocks';

beforeEach(() => {
  fakeBrowser.reset();
  fakeBrowser.runtime.id = 'test';
  vi.stubGlobal('chrome', fakeBrowser);
});

it('registers synchronously and propagates results, validation errors and execution errors through the proxy', async () => {
  const registration = vi.spyOn(browser.runtime.onMessage, 'addListener');
  startBackground();
  expect(registration).toHaveBeenCalledTimes(1);
  await expect(background.getProblem('two-sum', 'leetcode.com')).resolves.toEqual(testCatalog[0]);
  await expect(background.getProblem('missing', 'leetcode.com')).rejects.toThrow(
    'Unknown problem: missing on leetcode.com'
  );
  await background.addCard({ frontendId: '1', domain: 'leetcode.com' });
  await expect(background.saveNote('1', 'a'.repeat(501))).rejects.toMatchObject({ name: 'ZodError' });
  expect((await readLearningDocument()).cards['1'].note).toBeUndefined();
  const failure = new Error('Storage unavailable');
  vi.spyOn(browser.storage.local, 'set').mockRejectedValueOnce(failure);
  await expect(background.saveNote('1', 'failed')).rejects.toThrow('Storage unavailable');
  await expect(background.saveNote('1', 'saved')).resolves.toBeUndefined();
  expect((await readLearningDocument()).cards['1'].note).toBe('saved');
});

it.each(['success', 'failure'] as const)('holds proxy calls until catalog startup %s', async (outcome) => {
  const release = Promise.withResolvers<void>();
  const fetchCatalog = vi.mocked(fetch).getMockImplementation();
  if (!fetchCatalog) throw new Error('Catalog fetch was not configured');
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    await release.promise;
    if (outcome === 'failure') throw new Error('Catalog unavailable');
    return fetchCatalog(input, init);
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  startBackground();
  const settled = vi.fn();
  const calls = Promise.allSettled([
    background.waitForInitialization(),
    background.addCard({ frontendId: '1', domain: 'leetcode.com' }),
  ]).then((results) => {
    settled();
    return results;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(settled).not.toHaveBeenCalled();
  expect(await browser.storage.local.get(null)).toEqual({});
  release.resolve();
  const results = await calls;
  if (outcome === 'success') {
    expect(results).toEqual([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ]);
    expect((await readLearningDocument()).cards['1']).toBeDefined();
  } else {
    for (const result of results)
      expect(result).toMatchObject({ status: 'rejected', reason: { message: 'Catalog unavailable' } });
    expect(await browser.storage.local.get(null)).toEqual({});
  }
});
