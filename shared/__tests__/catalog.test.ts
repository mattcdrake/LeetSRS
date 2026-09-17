import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { z } from 'zod';
import type { CatalogProblem } from '@/shared/catalog';

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
const cnProblem: CatalogProblem = { ...twoSum, frontendId: '2', slug: 'cn-problem', sources: ['leetcode.cn'] };

const roadmapSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sourceUrl: z.url(),
  groups: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        frontendIds: z.array(z.string().min(1)).min(1),
      })
    )
    .min(1),
});

it.each(['blind-75', 'neetcode-150', 'neetcode-250', 'grind-75'])('%s matches the roadmap schema', (id) => {
  const data = JSON.parse(readFileSync(`public/data/roadmaps/${id}.json`, 'utf8'));
  expect(() => roadmapSchema.parse(data)).not.toThrow();
});

beforeEach(() => {
  vi.resetModules();
  vi.mocked(fetch).mockImplementation(async (url) => {
    const problems = [twoSum, cnProblem];
    if (url === browser.runtime.getURL('/data/leetcode-catalog-by-id.json')) {
      return Response.json(Object.fromEntries(problems.map((problem) => [problem.frontendId, problem])));
    }
    if (url === browser.runtime.getURL('/data/leetcode-catalog-by-slug.json')) {
      return Response.json(Object.fromEntries(problems.map((problem) => [problem.slug, problem])));
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
});

it('loads only the requested file and shares concurrent and subsequent reads', async () => {
  const { getProblemBySlug, getProblemsByFrontendIds } = await import('@/shared/catalog');
  expect(fetch).not.toHaveBeenCalled();
  expect(await getProblemsByFrontendIds([])).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
  await Promise.all([getProblemBySlug('two-sum', 'leetcode.com'), getProblemBySlug('cn-problem', 'leetcode.cn')]);
  await getProblemBySlug('two-sum', 'leetcode.com');
  expect(fetch).toHaveBeenCalledExactlyOnceWith(browser.runtime.getURL('/data/leetcode-catalog-by-slug.json'));
  const refs = [{ frontendId: '1', domain: 'leetcode.com' as const }];
  await Promise.all([getProblemsByFrontendIds(refs), getProblemsByFrontendIds(refs)]);
  await getProblemsByFrontendIds(refs);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenLastCalledWith(browser.runtime.getURL('/data/leetcode-catalog-by-id.json'));
});

it('returns mixed-domain and missing IDs in input order', async () => {
  const { getProblemsByFrontendIds } = await import('@/shared/catalog');
  expect(
    await getProblemsByFrontendIds([
      { frontendId: '2', domain: 'leetcode.cn' },
      { frontendId: '1', domain: 'leetcode.cn' },
      { frontendId: 'missing', domain: 'leetcode.com' },
      { frontendId: '1', domain: 'leetcode.com' },
      { frontendId: '2', domain: 'leetcode.com' },
      { frontendId: 'constructor', domain: 'leetcode.com' },
    ])
  ).toEqual([cnProblem, undefined, undefined, twoSum, undefined, undefined]);
});

it('returns a slug match only for an available domain', async () => {
  const { getProblemBySlug } = await import('@/shared/catalog');
  expect(await getProblemBySlug('two-sum', 'leetcode.com')).toEqual(twoSum);
  expect(await getProblemBySlug('two-sum', 'leetcode.cn')).toBeUndefined();
  expect(await getProblemBySlug('missing', 'leetcode.com')).toBeUndefined();
  expect(await getProblemBySlug('constructor', 'leetcode.com')).toBeUndefined();
});

it.each(['id', 'slug'] as const)('surfaces %s catalog loading failures', async (field) => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
  const { getProblemBySlug, getProblemsByFrontendIds } = await import('@/shared/catalog');
  const result =
    field === 'slug'
      ? getProblemBySlug('two-sum', 'leetcode.com')
      : getProblemsByFrontendIds([{ frontendId: '1', domain: 'leetcode.com' }]);
  await expect(result).rejects.toThrow('Failed to load catalog JSON: 404');
});
