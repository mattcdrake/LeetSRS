import type { LeetcodeDomain } from '@/shared/leetcode-domain';

export function getCurrentDomain(): LeetcodeDomain {
  return window.location.hostname.includes('leetcode.cn') ? 'leetcode.cn' : 'leetcode.com';
}

export function getCurrentProblemSlug(): string | null {
  return window.location.pathname.match(/\/problems\/([^/]+)/)?.[1] || null;
}
