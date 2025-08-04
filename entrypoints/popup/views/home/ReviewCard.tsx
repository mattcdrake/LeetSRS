import { FaArrowUpRightFromSquare } from 'react-icons/fa6';
import { Difficulty, type Card } from '@/shared/cards';
import { useRateCardMutation } from '@/hooks/useBackgroundQueries';
import { Rating } from 'ts-fsrs';
import type { Grade } from 'ts-fsrs';
import { Button } from 'react-aria-components';
import { bounceButton } from '@/shared/styles';

type ReviewCardProps = {
  card: Pick<Card, 'slug' | 'leetcodeId' | 'name' | 'difficulty'>;
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
  { rating: Rating.Again, label: 'Again', colorClass: 'bg-rating-again' },
  { rating: Rating.Hard, label: 'Hard', colorClass: 'bg-rating-hard' },
  { rating: Rating.Good, label: 'Good', colorClass: 'bg-rating-good' },
  { rating: Rating.Easy, label: 'Easy', colorClass: 'bg-rating-easy' },
];

export function ReviewCard({ card }: ReviewCardProps) {
  const rateCardMutation = useRateCardMutation();

  const difficultyColor = difficultyColorMap[card.difficulty] || 'bg-difficulty-medium';

  const handleRating = (rating: Grade) => {
    rateCardMutation.mutate({
      slug: card.slug,
      name: card.name,
      rating,
      leetcodeId: card.leetcodeId,
      difficulty: card.difficulty,
    });
  };

  return (
    <div className="border border-current rounded-lg bg-secondary p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-secondary">#{card.leetcodeId}</span>
        <span className={`text-xs px-2 py-1 rounded text-white ${difficultyColor}`}>{card.difficulty}</span>
      </div>

      <div className="flex justify-center pb-3 -mt-1 text-center">
        <a
          href={`https://leetcode.com/problems/${card.slug}/description/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-lg font-semibold text-primary group"
        >
          {card.name}
          <FaArrowUpRightFromSquare className="inline ml-1.5 text-xs opacity-60 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>

      <div className="flex gap-2 justify-center">
        {ratingButtons.map(({ rating, label, colorClass }) => (
          <Button
            key={label}
            onPress={() => handleRating(rating)}
            className={`w-16 py-1.5 rounded text-sm ${colorClass} text-white hover:opacity-90 ${bounceButton}`}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
