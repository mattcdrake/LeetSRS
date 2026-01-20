import type { Difficulty } from '@/shared/cards';

export interface ProblemData {
  difficulty: Difficulty;
  title: string;
  titleSlug: string;
  questionFrontendId: string;
}
