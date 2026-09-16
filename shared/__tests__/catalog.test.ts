import { IDBDatabase, IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import {
  type CatalogProblem,
  getProblemByFrontendId,
  getProblemBySlug,
  getProblemsByFrontendIds,
  initializeCatalog,
} from '@/shared/catalog';

const twoSum: CatalogProblem = {
  frontendId: '1',
  title: 'Two Sum',
  translatedTitle: '两数之和',
  slug: 'two-sum',
  difficulty: 'easy',
  isPaidOnly: false,
  topics: ['array', 'hash-table'],
  sources: ['leetcode.com'],
};

function bundle(problems: CatalogProblem[], hash = 'first-hash') {
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (url === browser.runtime.getURL('/data/leetcode-catalog.sha256')) return new Response(`${hash}\n`);
    if (url === browser.runtime.getURL('/data/leetcode-catalog.json')) return Response.json(problems);
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

beforeEach(() => bundle([twoSum]));

it.each(['transaction', 'abort'] as const)('closes the batch connection after a %s failure', async (failure) => {
  await initializeCatalog();
  const close = vi.spyOn(IDBDatabase.prototype, 'close');
  const error = new Error('Catalog read failed');
  if (failure === 'transaction') {
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(() => {
      throw error;
    });
  } else {
    const get = IDBObjectStore.prototype.get;
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementationOnce(function (this: IDBObjectStore, key) {
      const request = get.call(this, key);
      queueMicrotask(() => this.transaction.abort());
      return request;
    });
  }

  const result = getProblemsByFrontendIds([
    { frontendId: '1', domain: 'leetcode.com' },
    { frontendId: 'missing', domain: 'leetcode.cn' },
  ]);
  if (failure === 'abort') {
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  } else {
    await expect(result).rejects.toThrow(error);
  }
  expect(close).toHaveBeenCalledTimes(1);
});

it('looks up mixed-domain and missing IDs in input order using one readonly transaction and connection', async () => {
  const cnProblem = {
    ...twoSum,
    frontendId: '2',
    slug: 'cn-problem',
    sources: ['leetcode.cn'],
  } satisfies CatalogProblem;
  bundle([twoSum, cnProblem]);
  await initializeCatalog();
  const open = vi.spyOn(indexedDB, 'open');
  const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
  const close = vi.spyOn(IDBDatabase.prototype, 'close');

  expect(
    await getProblemsByFrontendIds([
      { frontendId: '2', domain: 'leetcode.cn' },
      { frontendId: '1', domain: 'leetcode.cn' },
      { frontendId: 'missing', domain: 'leetcode.com' },
      { frontendId: '1', domain: 'leetcode.com' },
      { frontendId: '2', domain: 'leetcode.com' },
    ])
  ).toEqual([cnProblem, undefined, undefined, twoSum, undefined]);
  expect(open).toHaveBeenCalledTimes(1);
  expect(transaction).toHaveBeenCalledExactlyOnceWith('problems', 'readonly');
  expect(close).toHaveBeenCalledTimes(1);
});

it.each([
  { lookup: getProblemByFrontendId, key: '1' },
  { lookup: getProblemBySlug, key: 'two-sum' },
])('returns the complete problem only for an available domain: $key', async ({ lookup, key }) => {
  await initializeCatalog();

  expect(await lookup(key, 'leetcode.com')).toEqual(twoSum);
  expect(await lookup(key, 'leetcode.cn')).toBeUndefined();
  expect(await lookup('missing', 'leetcode.com')).toBeUndefined();
});

it('skips loading JSON when the catalog hash is unchanged', async () => {
  await initializeCatalog();
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (url === browser.runtime.getURL('/data/leetcode-catalog.sha256')) return new Response('first-hash\n');
    throw new Error('An unchanged catalog must not load JSON');
  });
  await initializeCatalog();

  expect(await getProblemBySlug('two-sum', 'leetcode.com')).toEqual(twoSum);
});

it('replaces the catalog when the hash changes, including additions and removals', async () => {
  bundle([twoSum, { ...twoSum, frontendId: '2', slug: 'removed' }]);
  await initializeCatalog();
  const updated = { ...twoSum, title: 'Updated title' };
  const added = { ...twoSum, frontendId: '3', slug: 'new-problem' };
  bundle([updated, added], 'second-hash');

  await initializeCatalog();

  expect(await getProblemByFrontendId('1', 'leetcode.com')).toEqual(updated);
  expect(await getProblemByFrontendId('2', 'leetcode.com')).toBeUndefined();
  expect(await getProblemBySlug('new-problem', 'leetcode.com')).toEqual(added);
});
