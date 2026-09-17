import type { CatalogProblem } from '@/shared/catalog';

export const testCatalog: CatalogProblem[] = [
  {
    frontendId: '1',
    slug: 'two-sum',
    title: 'Two Sum',
    translatedTitle: '两数之和',
    difficulty: 'easy',
    isPaidOnly: false,
    topics: ['array'],
    sources: ['leetcode.com', 'leetcode.cn'],
  },
  {
    frontendId: '2',
    slug: 'add-two-numbers',
    title: 'Add Two Numbers',
    translatedTitle: null,
    difficulty: 'medium',
    isPaidOnly: false,
    topics: [],
    sources: ['leetcode.com', 'leetcode.cn'],
  },
  {
    frontendId: '3',
    slug: 'longest-substring',
    title: 'Longest Substring',
    translatedTitle: null,
    difficulty: 'medium',
    isPaidOnly: false,
    topics: [],
    sources: ['leetcode.com'],
  },
  ...['new-a', 'new-b', 'review', 'future', 'paused', 'next-card', 'editor-card', 'other-card', 'com-only'].map(
    (frontendId): CatalogProblem => ({
      frontendId,
      slug: frontendId,
      title: frontendId,
      translatedTitle: null,
      difficulty: 'easy',
      isPaidOnly: false,
      topics: [],
      sources: ['leetcode.com'],
    })
  ),
  {
    frontendId: '271',
    slug: 'encode-and-decode-strings',
    title: 'Encode and Decode Strings',
    translatedTitle: null,
    difficulty: 'medium',
    isPaidOnly: true,
    topics: ['string'],
    sources: ['leetcode.com', 'leetcode.cn'],
  },
];
