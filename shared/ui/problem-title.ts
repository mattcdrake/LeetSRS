import type { CatalogProblem } from '@/shared/catalog';
import type { LeetcodeDomain } from '@/shared/models';

export function getProblemTitle(problem: CatalogProblem, domain: LeetcodeDomain): string {
  return domain === 'leetcode.cn' ? problem.translatedTitle || problem.title : problem.title;
}
