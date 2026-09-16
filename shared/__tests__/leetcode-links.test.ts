import { describe, expect, it } from 'vitest';
import { isLeetcodeCnUrl } from '@/shared/leetcode-links';

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
