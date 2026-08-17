import type { Card as FsrsCard, Grade } from 'ts-fsrs';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type LeetcodeDomain = 'leetcode.com' | 'leetcode.cn';

export interface ProblemDescriptor {
  slug: string;
  name: string;
  leetcodeId: string;
  difficulty: Difficulty;
  domain: LeetcodeDomain;
}

export type RateCardInput = ProblemDescriptor & {
  rating: Grade;
};

export interface Card extends ProblemDescriptor {
  id: string;
  createdAt: Date;
  fsrs: FsrsCard;
  paused: boolean;
}
