import { Rating } from 'ts-fsrs';

interface BaseStats {
  totalReviews: number;
  gradeBreakdown: {
    [Rating.Again]: number;
    [Rating.Hard]: number;
    [Rating.Good]: number;
    [Rating.Easy]: number;
  };
  newCards: number;
  reviewedCards: number;
}

export interface DailyStats extends BaseStats {
  date: string;
  streak: number;
}

export interface UpcomingReviewStats {
  date: string;
  count: number;
}
