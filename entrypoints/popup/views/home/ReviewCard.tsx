import { FaArrowUpRightFromSquare } from 'react-icons/fa6';
import { Difficulty, type Card } from '@/shared/cards';
import { Rating } from 'ts-fsrs';
import type { Grade } from 'ts-fsrs';
import { Button } from 'react-aria-components';
import { bounceButton } from '@/shared/styles';
import { i18n } from '@/shared/i18n';

type ReviewCardProps = {
  card: Pick<Card, 'slug' | 'leetcodeId' | 'name' | 'difficulty'>;
  onRate: (rating: Grade) => void;
  isProcessing?: boolean;
};

type RatingButtonConfig = {
  rating: Grade;
  label: string;
  colorClass: string;
};

const difficultyColorMap: Record<Difficulty, string> = {
  Easy: 'bg-difficulty-easy',
  Medium: 'bg-difficulty-medium',
  Hard: 'bg-difficulty-hard',
};

const ratingButtons: RatingButtonConfig[] = [
  { rating: Rating.Again, label: i18n.ratings.again, colorClass: 'bg-rating-again' },
  { rating: Rating.Hard, label: i18n.ratings.hard, colorClass: 'bg-rating-hard' },
  { rating: Rating.Good, label: i18n.ratings.good, colorClass: 'bg-rating-good' },
  { rating: Rating.Easy, label: i18n.ratings.easy, colorClass: 'bg-rating-easy' },
];

export function ReviewCard({ card, onRate, isProcessing = false }: ReviewCardProps) {
  const difficultyColor = difficultyColorMap[card.difficulty] || 'bg-difficulty-medium';
  const leetcodeUrl = `https://leetcode.com/problems/${card.slug}/description/`;

  const handleRating = (rating: Grade) => {
    onRate(rating);
  };

  return (
    <div className="border border-current rounded-lg bg-secondary p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-secondary">#{card.leetcodeId}</span>
        <span className={`text-xs px-2 py-1 rounded text-white ${difficultyColor}`}>{card.difficulty}</span>
      </div>

      <div className="flex flex-col items-center gap-1 pb-3 -mt-1 text-center">
        <span className="text-lg font-semibold text-primary">{card.name}</span>
        <div className="flex items-center gap-3 text-sm text-secondary">
          <a
            href={leetcodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1 hover:text-primary"
          >
            LeetCode
            <FaArrowUpRightFromSquare className="text-xs opacity-60 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>
      </div>

      <div className="flex gap-2 justify-center">
        {ratingButtons.map(({ rating, label, colorClass }) => (
          <Button
            key={label}
            onPress={() => handleRating(rating)}
            isDisabled={isProcessing}
            className={`w-20 py-2 rounded text-base ${colorClass} text-white hover:opacity-90 ${bounceButton} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
