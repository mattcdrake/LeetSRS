import { describe, expect, it } from 'vitest';
import { getLeetcodeProblemUrl } from '@/shared/leetcode';

describe('getLeetcodeProblemUrl', () => {
  it.each([
    ['leetcode.com', 'two-sum', 'https://leetcode.com/problems/two-sum/description/'],
    ['leetcode.cn', 'add-two-numbers', 'https://leetcode.cn/problems/add-two-numbers/description/'],
  ] as const)('builds a problem URL for %s', (domain, slug, expected) => {
    expect(getLeetcodeProblemUrl({ domain, slug })).toBe(expected);
  });
});
