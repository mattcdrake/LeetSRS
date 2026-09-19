import { Button } from 'react-aria-components';
import { FaArrowUpRightFromSquare } from 'react-icons/fa6';
import type { Grade } from 'ts-fsrs';
import { useTheme } from '@/popup/hooks/useTheme';
import type { CardWithProblem } from '@/popup/queries/cards';
import { useSettingsQuery } from '@/popup/queries/settings';
import { buttonInteraction } from '@/popup/styles';
import { authorizeEditorReset, getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import { ratingSchema } from '@/shared/models';
import { DIFFICULTY_COLORS } from '@/shared/ui/difficulty-colors';
import { getProblemTitle } from '@/shared/ui/problem-title';
import { RATING_COLORS } from '@/shared/ui/rating-colors';
import { useI18n } from '../../contexts/I18nContext';

type ReviewCardProps = {
  card: CardWithProblem;
  onRate: (rating: Grade) => void;
  isProcessing?: boolean;
};

export function ReviewCard({ card, onRate, isProcessing = false }: ReviewCardProps) {
  const t = useI18n();
  const colors = RATING_COLORS[useTheme()];
  const { data: settings } = useSettingsQuery();
  const difficultyColor = DIFFICULTY_COLORS[card.difficulty] ?? DIFFICULTY_COLORS.medium;
  const problemUrl = getLeetcodeProblemUrl(card);
  const href = settings.resetEditorOnReviewQueue ? authorizeEditorReset(problemUrl) : problemUrl;

  return (
    <div className="border border-current rounded-lg bg-secondary p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-secondary">#{card.frontendId}</span>
        <span className="text-xs capitalize" style={{ color: difficultyColor }}>
          {card.difficulty}
        </span>
      </div>

      <div className="flex justify-center pb-3 -mt-1 text-center">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-lg font-medium text-primary group"
          aria-label="LeetCode problem"
        >
          {getProblemTitle(card, card.domain)}
          <FaArrowUpRightFromSquare
            aria-hidden="true"
            className="inline ml-1.5 text-xs opacity-60 group-hover:opacity-100 transition-opacity"
          />
        </a>
      </div>

      <div className="flex gap-2 justify-center">
        {[...ratingSchema.values].map((rating) => (
          <Button
            key={rating}
            onPress={() => onRate(rating)}
            isDisabled={isProcessing}
            style={{ backgroundColor: colors[rating] }}
            className={`flex-1 min-w-0 min-h-10 px-1 py-2 rounded-lg text-xs text-white hover:opacity-90 ${buttonInteraction} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {t.ratings[rating]}
          </Button>
        ))}
      </div>
    </div>
  );
}
