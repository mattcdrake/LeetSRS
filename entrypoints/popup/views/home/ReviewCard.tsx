import { Button } from 'react-aria-components';
import { FaArrowUpRightFromSquare } from 'react-icons/fa6';
import type { Grade } from 'ts-fsrs';
import type { Card } from '@/domain/cards';
import { RATINGS } from '@/domain/ratings';
import { useTheme } from '@/entrypoints/popup/hooks/useTheme';
import { getLeetcodeProblemUrl } from '@/entrypoints/popup/leetcode';
import { bounceButton } from '@/entrypoints/popup/styles';
import { DIFFICULTY_COLORS } from '@/ui/difficulty-colors';
import { RATING_COLORS } from '@/ui/rating-colors';
import { useI18n } from '../../contexts/I18nContext';

type ReviewCardProps = {
  card: Pick<Card, 'slug' | 'leetcodeId' | 'name' | 'difficulty' | 'domain'>;
  onRate: (rating: Grade) => void;
  isProcessing?: boolean;
};

export function ReviewCard({ card, onRate, isProcessing = false }: ReviewCardProps) {
  const t = useI18n();
  const colors = RATING_COLORS[useTheme()];
  const difficultyColor = DIFFICULTY_COLORS[card.difficulty] ?? DIFFICULTY_COLORS.Medium;

  return (
    <div className="border border-current rounded-lg bg-secondary p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-secondary">#{card.leetcodeId}</span>
        <span className="text-xs px-2 py-1 rounded text-white" style={{ backgroundColor: difficultyColor }}>
          {card.difficulty}
        </span>
      </div>

      <div className="flex justify-center pb-3 -mt-1 text-center">
        <a
          href={getLeetcodeProblemUrl(card)}
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
        {RATINGS.map(({ rating, key }) => (
          <Button
            key={key}
            onPress={() => onRate(rating)}
            isDisabled={isProcessing}
            style={{ backgroundColor: colors[key] }}
            className={`w-20 py-1.5 rounded text-sm text-white hover:opacity-90 ${bounceButton} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {t.ratings[key]}
          </Button>
        ))}
      </div>
    </div>
  );
}
