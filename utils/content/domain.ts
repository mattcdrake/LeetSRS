/**
 * Domain utilities for supporting both leetcode.com and leetcode.cn
 */

import type { LeetcodeDomain } from '@/shared/cards';

export type { LeetcodeDomain };

/**
 * Detects the current LeetCode domain based on the hostname
 */
export function getCurrentDomain(): LeetcodeDomain {
  const hostname = window.location.hostname;
  if (hostname.includes('leetcode.cn')) {
    return 'leetcode.cn';
  }
  return 'leetcode.com';
}

/**
 * Returns the GraphQL API URL for the current domain
 */
export function getGraphQLUrl(): string {
  const domain = getCurrentDomain();
  return `https://${domain}/graphql`;
}

/**
 * Returns the problem URL for a given slug on the current domain
 */
export function getProblemUrl(slug: string): string {
  const domain = getCurrentDomain();
  return `https://${domain}/problems/${slug}/description/`;
}
