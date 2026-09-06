/**
 * Domain utilities for supporting both leetcode.com and leetcode.cn
 */

import type { LeetcodeDomain } from '@/shared/cards';

type LeetCodeWindow = Window & {
  next?: {
    router?: {
      query?: {
        slug?: string;
      };
    };
  };
};

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
 * Returns the slug for the problem currently displayed by LeetCode.
 */
export function getCurrentProblemSlug(): string | null {
  const routerSlug = (window as LeetCodeWindow).next?.router?.query?.slug;
  if (routerSlug) {
    return routerSlug;
  }

  const pathMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
  return pathMatch ? pathMatch[1] : null;
}
