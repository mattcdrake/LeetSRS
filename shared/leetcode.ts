import type { LeetcodeDomain } from '@/shared/cards';

interface LeetcodeProblemLink {
  domain: LeetcodeDomain;
  slug: string;
}

export function getLeetcodeProblemUrl({ domain, slug }: LeetcodeProblemLink): string {
  return `https://${domain}/problems/${slug}/description/`;
}
