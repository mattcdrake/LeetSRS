import { describe, expect, it } from 'vitest';
import { getLeetcodeProblemUrl, isLeetcodeCnUrl } from '@/entrypoints/popup/leetcode';

describe('getLeetcodeProblemUrl', () => {
  it.each([
    ['leetcode.com', 'two-sum', 'https://leetcode.com/problems/two-sum/description/'],
    ['leetcode.cn', 'add-two-numbers', 'https://leetcode.cn/problems/add-two-numbers/description/'],
  ] as const)('builds a problem URL for %s', (domain, slug, expected) => {
    expect(getLeetcodeProblemUrl({ domain, slug })).toBe(expected);
  });
});

describe('isLeetcodeCnUrl', () => {
  it.each([
    { url: 'https://leetcode.cn/problems/two-sum/', expected: true },
    { url: 'https://www.leetcode.cn/problemset/', expected: true },
    { url: null, expected: false },
    { url: '', expected: false },
    { url: 'not-a-url', expected: false },
    { url: 'https://leetcode.com/', expected: false },
    { url: 'https://leetcode.cn.example.com/', expected: false },
  ])('returns $expected for $url', ({ url, expected }) => {
    expect(isLeetcodeCnUrl(url)).toBe(expected);
  });
});
