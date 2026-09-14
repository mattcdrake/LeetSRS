import {
  createEmptyCard,
  FSRS,
  type Card as FsrsCard,
  type Grade as FsrsGrade,
  Rating as FsrsRating,
  State as FsrsState,
  generatorParameters,
} from 'ts-fsrs';
import { Rating } from './ratings';
import { LearningState, type Schedule, type Scheduler, scheduleSchema } from './scheduling';

function toFsrsRating(rating: Rating): FsrsGrade {
  switch (rating) {
    case Rating.Again:
      return FsrsRating.Again;
    case Rating.Hard:
      return FsrsRating.Hard;
    case Rating.Good:
      return FsrsRating.Good;
    case Rating.Easy:
      return FsrsRating.Easy;
    default:
      throw new Error(`Unsupported rating: ${rating}`);
  }
}

function toFsrsState(state: LearningState): FsrsState {
  switch (state) {
    case LearningState.New:
      return FsrsState.New;
    case LearningState.Learning:
      return FsrsState.Learning;
    case LearningState.Review:
      return FsrsState.Review;
    case LearningState.Relearning:
      return FsrsState.Relearning;
    default:
      throw new Error(`Unsupported learning state: ${state}`);
  }
}

function fromFsrsState(state: FsrsState): LearningState {
  switch (state) {
    case FsrsState.New:
      return LearningState.New;
    case FsrsState.Learning:
      return LearningState.Learning;
    case FsrsState.Review:
      return LearningState.Review;
    case FsrsState.Relearning:
      return LearningState.Relearning;
    default:
      throw new Error(`Unsupported FSRS state: ${state}`);
  }
}

function toFsrsCard(schedule: Schedule): FsrsCard {
  return {
    ...schedule,
    due: new Date(schedule.due),
    last_review: schedule.last_review === undefined ? undefined : new Date(schedule.last_review),
    state: toFsrsState(schedule.state),
  };
}

function fromFsrsCard(card: FsrsCard): Schedule {
  return scheduleSchema.parse({
    ...card,
    due: card.due.getTime(),
    last_review: card.last_review?.getTime(),
    state: fromFsrsState(card.state),
  });
}

export function createFsrsScheduler(): Scheduler {
  const fsrs = new FSRS(generatorParameters({ maximum_interval: 1000, enable_short_term: false }));

  return {
    createSchedule(now) {
      return fromFsrsCard(createEmptyCard(now));
    },
    review(schedule, rating, now) {
      return fromFsrsCard(fsrs.next(toFsrsCard(schedule), now, toFsrsRating(rating)).card);
    },
  };
}
