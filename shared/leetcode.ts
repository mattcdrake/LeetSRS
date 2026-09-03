import type { LeetcodeDomain } from '@/shared/cards';

interface LeetcodeProblemLink {
  domain: LeetcodeDomain;
  slug: string;
}

export function getLeetcodeProblemUrl({ domain, slug }: LeetcodeProblemLink): string {
  return `https://${domain}/problems/${slug}/description/`;
}

export function isLeetcodeCnUrl(url: string | null): boolean {
  if (!url) return false;

  try {
    const hostname = new URL(url).hostname;
    return hostname === 'leetcode.cn' || hostname.endsWith('.leetcode.cn');
  } catch {
    return false;
  }
}
