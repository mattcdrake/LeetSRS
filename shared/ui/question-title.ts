import type { CatalogQuestion } from '@/shared/catalog';
import type { LeetcodeDomain } from '@/shared/models';

export function getQuestionTitle(question: CatalogQuestion, domain: LeetcodeDomain): string {
  return domain === 'leetcode.cn' ? question.translatedTitle || question.title : question.title;
}
