import { beforeEach, expect, it, vi } from 'vitest';
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
  sources: ['leetcode.com'],
};

function bundle(questions: CatalogQuestion[], hash = 'first-hash') {
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (url === browser.runtime.getURL('/data/leetcode-catalog.sha256')) return new Response(`${hash}\n`);
    if (url === browser.runtime.getURL('/data/leetcode-catalog.json')) return Response.json(questions);
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

beforeEach(() => bundle([twoSum]));

it.each([
  { lookup: getQuestionByFrontendId, key: '1' },
  { lookup: getQuestionBySlug, key: 'two-sum' },
])('returns the complete question only for an available domain: $key', async ({ lookup, key }) => {
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

  expect(await getQuestionBySlug('two-sum', 'leetcode.com')).toEqual(twoSum);
});

it('replaces the catalog when the hash changes, including additions and removals', async () => {
  bundle([twoSum, { ...twoSum, frontendId: '2', slug: 'removed' }]);
  await initializeCatalog();
  const updated = { ...twoSum, title: 'Updated title' };
  const added = { ...twoSum, frontendId: '3', slug: 'new-question' };
  bundle([updated, added], 'second-hash');

  await initializeCatalog();

  expect(await getQuestionByFrontendId('1', 'leetcode.com')).toEqual(updated);
  expect(await getQuestionByFrontendId('2', 'leetcode.com')).toBeUndefined();
  expect(await getQuestionBySlug('new-question', 'leetcode.com')).toEqual(added);
});
