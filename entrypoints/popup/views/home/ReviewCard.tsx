import { FaArrowUpRightFromSquare } from 'react-icons/fa6';
import { Difficulty, type Card } from '@/shared/cards';
import { Rating } from 'ts-fsrs';
import type { Grade } from 'ts-fsrs';
import { Button } from 'react-aria-components';
import { bounceButton } from '@/shared/styles';
import { useI18n } from '../../contexts/I18nContext';

type ReviewCardProps = {
  card: Pick<Card, 'slug' | 'leetcodeId' | 'name' | 'difficulty'>;
  onRate: (rating: Grade) => void;
  isProcessing?: boolean;
};

type RatingButtonConfig = {
  rating: Grade;
  labelKey: 'again' | 'hard' | 'good' | 'easy';
  colorClass: string;
};

const difficultyColorMap: Record<Difficulty, string> = {
  Easy: 'bg-difficulty-easy',
  Medium: 'bg-difficulty-medium',
  Hard: 'bg-difficulty-hard',
};

const ratingButtonConfigs: RatingButtonConfig[] = [
  { rating: Rating.Again, labelKey: 'again', colorClass: 'bg-rating-again' },
  { rating: Rating.Hard, labelKey: 'hard', colorClass: 'bg-rating-hard' },
  { rating: Rating.Good, labelKey: 'good', colorClass: 'bg-rating-good' },
  { rating: Rating.Easy, labelKey: 'easy', colorClass: 'bg-rating-easy' },
];

export function ReviewCard({ card, onRate, isProcessing = false }: ReviewCardProps) {
  const t = useI18n();
  const difficultyColor = difficultyColorMap[card.difficulty] || 'bg-difficulty-medium';

  const handleRating = (rating: Grade) => {
    onRate(rating);
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
          aria-label="LeetCode problem"
        >
          {card.name}
          <FaArrowUpRightFromSquare className="inline ml-1.5 text-xs opacity-60 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>

      <div className="flex gap-2 justify-center">
        {ratingButtonConfigs.map(({ rating, labelKey, colorClass }) => (
          <Button
            key={labelKey}
            onPress={() => handleRating(rating)}
            isDisabled={isProcessing}
            className={`w-20 py-1.5 rounded text-sm ${colorClass} text-white hover:opacity-90 ${bounceButton} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {t.ratings[labelKey]}
          </Button>
        ))}
      </div>
    </div>
  );
}
