import { getCurrentDomain, getCurrentProblemSlug } from '@/content/page-context';
import { background } from '@/shared/background-service';
import type { CatalogProblem } from '@/shared/catalog';
import type { LeetcodeDomain } from '@/shared/leetcode-domain';

export async function getCurrentProblem(): Promise<CatalogProblem & { domain: LeetcodeDomain }> {
  const slug = getCurrentProblemSlug();
  if (!slug) throw new Error('Expected a problem slug on the current page');
  const domain = getCurrentDomain();
  const problem = await background.getProblem(slug, domain);
  return { ...problem, domain };
}
