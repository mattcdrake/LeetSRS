import { z } from 'zod';
import type { Rating } from './ratings';

export enum LearningState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export const learningStateSchema = z.literal([
  LearningState.New,
  LearningState.Learning,
  LearningState.Review,
  LearningState.Relearning,
]);

const count = z.int().nonnegative();
const epochMilliseconds = z.number().min(-8.64e15).max(8.64e15);

export const scheduleSchema = z.object({
  due: epochMilliseconds,
  last_review: epochMilliseconds.optional(),
  state: learningStateSchema,
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsed_days: z.number().nonnegative(),
  scheduled_days: z.number().nonnegative(),
  reps: count,
  lapses: count,
  learning_steps: count,
});

export type Schedule = z.infer<typeof scheduleSchema>;

export interface Scheduler {
  createSchedule(now: Date): Schedule;
  review(schedule: Schedule, rating: Rating, now: Date): Schedule;
}
