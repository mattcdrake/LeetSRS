import type { LeetcodeDomain } from '@/domain/cards';

type LeetCodeWindow = Window & {
  next?: {
    router?: {
      query?: {
        slug?: string;
      };
    };
  };
};

export function getCurrentDomain(): LeetcodeDomain {
  const hostname = window.location.hostname;
  if (hostname.includes('leetcode.cn')) {
    return 'leetcode.cn';
  }
  return 'leetcode.com';
}

export function getGraphQLUrl(): string {
  const domain = getCurrentDomain();
  return `https://${domain}/graphql`;
}

export function getCurrentProblemSlug(): string | null {
  const routerSlug = (window as LeetCodeWindow).next?.router?.query?.slug;
  if (routerSlug) {
    return routerSlug;
  }

  const pathMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
  return pathMatch ? pathMatch[1] : null;
}
