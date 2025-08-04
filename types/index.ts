import type { Card as FsrsCard } from 'ts-fsrs';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Card {
  id: string;
  slug: string;
  name: string;
  leetcodeId: string;
  difficulty: Difficulty;
  createdAt: Date;
  fsrs: FsrsCard;
}
