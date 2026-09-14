import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { type CatalogQuestion, getQuestionByFrontendId, getQuestionBySlug, initializeCatalog } from '@/shared/catalog';

const twoSum: CatalogQuestion = {
  frontendId: '1',
  title: 'Two Sum',
  translatedTitle: '两数之和',
  slug: 'two-sum',
  difficulty: 'easy',
  isPaidOnly: false,
  topics: ['array', 'hash-table'],
  sources: ['leetcode.cn', 'leetcode.com'],
};

const fetchBundle = vi.fn<typeof fetch>();

function bundle(questions: CatalogQuestion[], hash = 'first-hash') {
  fetchBundle.mockImplementation(async (url) => {
    if (url === browser.runtime.getURL('/data/leetcode-catalog.sha256')) return new Response(`${hash}\n`);
    if (url === browser.runtime.getURL('/data/leetcode-catalog.json')) return Response.json(questions);
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('fetch', fetchBundle);
  bundle([twoSum]);
});

afterEach(() => vi.unstubAllGlobals());

it('initializes the catalog with complete bundled question records', async () => {
  await initializeCatalog();

  expect(await getQuestionByFrontendId('1', 'leetcode.com')).toEqual(twoSum);
});

it.each([
  { lookup: getQuestionByFrontendId, key: '1', missing: ['01', ' 1', 'missing'] },
  { lookup: getQuestionBySlug, key: 'two-sum', missing: ['Two-Sum', 'two-sum/', 'missing'] },
])('looks up exact keys and filters availability internally: $key', async ({ lookup, key, missing }) => {
  bundle([{ ...twoSum, translatedTitle: null, sources: ['leetcode.com'] }]);
  await initializeCatalog();

  expect(await lookup(key, 'leetcode.com')).toEqual({ ...twoSum, translatedTitle: null, sources: ['leetcode.com'] });
  expect(await lookup(key, 'leetcode.cn')).toBeUndefined();
  for (const value of missing) expect(await lookup(value, 'leetcode.com')).toBeUndefined();
});

it('only reads the hash when the stored catalog is current, including after a module restart', async () => {
  await initializeCatalog();
  fetchBundle.mockClear();
  fetchBundle.mockImplementation(async (url) => {
    if (url === browser.runtime.getURL('/data/leetcode-catalog.sha256')) return new Response('first-hash\n');
    throw new Error('An unchanged catalog must not load JSON');
  });
  vi.resetModules();
  const restarted = await import('@/shared/catalog');

  await restarted.initializeCatalog();

  expect(fetchBundle).toHaveBeenCalledExactlyOnceWith(browser.runtime.getURL('/data/leetcode-catalog.sha256'));
  expect(await restarted.getQuestionBySlug('two-sum', 'leetcode.cn')).toEqual(twoSum);
});

it('replaces changed records and removes questions and slugs absent from a new bundle', async () => {
  const removed = { ...twoSum, frontendId: '2', slug: 'removed' };
  bundle([twoSum, removed]);
  await initializeCatalog();
  const updated: CatalogQuestion = {
    ...twoSum,
    slug: 'updated-two-sum',
    title: 'Updated title',
    sources: ['leetcode.cn'],
  };
  const added = { ...twoSum, frontendId: '01', slug: 'new-question' };
  bundle([updated, added], 'second-hash');

  await initializeCatalog();

  expect(await getQuestionByFrontendId('1', 'leetcode.cn')).toEqual(updated);
  expect(await getQuestionByFrontendId('1', 'leetcode.com')).toBeUndefined();
  expect(await getQuestionBySlug('two-sum', 'leetcode.com')).toBeUndefined();
  expect(await getQuestionByFrontendId('2', 'leetcode.com')).toBeUndefined();
  expect(await getQuestionBySlug('removed', 'leetcode.com')).toBeUndefined();
  expect(await getQuestionByFrontendId('01', 'leetcode.com')).toEqual(added);
});

it.each(['frontendId', 'slug'] as const)(
  'rolls back the catalog and hash together when duplicate %s records abort an import',
  async (field) => {
    await initializeCatalog();
    const replacement = { ...twoSum, frontendId: '2', slug: 'replacement' };
    const duplicate = { ...twoSum, frontendId: '3', slug: 'other', [field]: replacement[field] };
    bundle([replacement, duplicate], 'second-hash');

    await expect(initializeCatalog()).rejects.toMatchObject({ name: 'ConstraintError' });

    expect(await getQuestionByFrontendId('1', 'leetcode.com')).toEqual(twoSum);
    expect(await getQuestionBySlug('replacement', 'leetcode.com')).toBeUndefined();
    bundle([replacement], 'second-hash');
    await initializeCatalog();
    expect(await getQuestionByFrontendId('1', 'leetcode.com')).toBeUndefined();
    expect(await getQuestionBySlug('replacement', 'leetcode.com')).toEqual(replacement);
  }
);

it.each(['hash', 'JSON'] as const)('preserves the previous catalog when fetching %s fails', async (asset) => {
  await initializeCatalog();
  fetchBundle.mockImplementation(async (url) => {
    if (asset === 'JSON' && url === browser.runtime.getURL('/data/leetcode-catalog.sha256')) {
      return new Response('second-hash');
    }
    return new Response(asset === 'hash' ? 'second-hash' : '[]', { status: 500 });
  });

  await expect(initializeCatalog()).rejects.toThrow(`Failed to load catalog ${asset}: 500`);

  expect(await getQuestionByFrontendId('1', 'leetcode.com')).toEqual(twoSum);
});

it.each(['invalid JSON', 'invalid record'] as const)(
  'preserves the catalog after %s and permits a retry',
  async (failure) => {
    await initializeCatalog();
    fetchBundle.mockImplementation(async (url) =>
      url === browser.runtime.getURL('/data/leetcode-catalog.sha256')
        ? new Response('second-hash')
        : new Response(failure === 'invalid JSON' ? '[' : '[{"frontendId":"2"}]')
    );

    await expect(initializeCatalog()).rejects.toThrow();

    expect(await getQuestionBySlug('two-sum', 'leetcode.cn')).toEqual(twoSum);
    bundle([], 'second-hash');
    await initializeCatalog();
    expect(await getQuestionByFrontendId('1', 'leetcode.com')).toBeUndefined();
  }
);
