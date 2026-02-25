import type { Card as FsrsCard } from 'ts-fsrs';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type LeetcodeDomain = 'leetcode.com' | 'leetcode.cn';

export interface Card {
  id: string;
  slug: string;
  name: string;
  leetcodeId: string;
  difficulty: Difficulty;
  domain: LeetcodeDomain;
  createdAt: Date;
  fsrs: FsrsCard;
  paused: boolean;
}
