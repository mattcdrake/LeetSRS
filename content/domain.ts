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
  return window.location.hostname.includes('leetcode.cn') ? 'leetcode.cn' : 'leetcode.com';
}

export function getGraphQLUrl(): string {
  return `https://${getCurrentDomain()}/graphql`;
}

export function getCurrentProblemSlug(): string | null {
  const routerSlug = (window as LeetCodeWindow).next?.router?.query?.slug;
  return routerSlug || window.location.pathname.match(/\/problems\/([^/]+)/)?.[1] || null;
}
