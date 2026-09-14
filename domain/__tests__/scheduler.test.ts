import { describe, expect, it } from 'vitest';
import { createFsrsScheduler } from '../fsrs-scheduler';
import { Rating } from '../ratings';
import { LearningState, scheduleSchema } from '../scheduling';

const now = new Date('2024-03-15T12:00:00.000Z');

describe('FSRS scheduler', () => {
  const scheduler = createFsrsScheduler();

  it('creates the persisted initial schedule', () => {
    expect(scheduler.createSchedule(now)).toEqual({
      due: now.getTime(),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: LearningState.New,
      learning_steps: 0,
      last_review: undefined,
    });
  });

  it.each([
    [Rating.Again, 1, 0.212, 6.4133],
    [Rating.Hard, 2, 1.2931, 5.11217071],
    [Rating.Good, 3, 2.3065, 2.11810397],
    [Rating.Easy, 8, 8.2956, 1],
  ] as const)('applies rating %s with current scheduling policy', (rating, scheduledDays, stability, difficulty) => {
    const schedule = scheduler.review(scheduler.createSchedule(now), rating, now);

    expect(scheduleSchema.parse(schedule)).toEqual(schedule);
    expect(schedule).toEqual({
      due: new Date(`2024-03-${15 + scheduledDays}T12:00:00.000Z`).getTime(),
      last_review: now.getTime(),
      stability,
      difficulty,
      elapsed_days: 0,
      scheduled_days: scheduledDays,
      reps: 1,
      lapses: 0,
      learning_steps: 0,
      state: LearningState.Review,
    });
  });

  it('caps a long-term review at the current maximum-interval policy', () => {
    const schedule = scheduler.review(
      {
        due: now.getTime(),
        last_review: now.getTime() - 100 * 86_400_000,
        stability: 10_000,
        difficulty: 5,
        elapsed_days: 100,
        scheduled_days: 100,
        reps: 100,
        lapses: 0,
        learning_steps: 0,
        state: LearningState.Review,
      },
      Rating.Hard,
      now
    );

    expect(schedule.scheduled_days).toBe(1000);
    expect(schedule.due - now.getTime()).toBe(1000 * 86_400_000);
  });
});
