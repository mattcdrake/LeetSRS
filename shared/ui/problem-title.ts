import type { CatalogProblem } from '@/shared/catalog';
import type { LeetcodeDomain } from '@/shared/leetcode-domain';

export function getProblemTitle(problem: CatalogProblem, domain: LeetcodeDomain): string {
  return domain === 'leetcode.cn' ? problem.translatedTitle || problem.title : problem.title;
}
