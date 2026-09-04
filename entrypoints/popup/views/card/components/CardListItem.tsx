import { Button } from 'react-aria-components';
import { FaArrowUpRightFromSquare, FaCirclePause, FaPlay, FaTrash } from 'react-icons/fa6';
import { State as FsrsState } from 'ts-fsrs';
import { getLeetcodeProblemUrl } from '@/entrypoints/popup/leetcode';
import { bounceButton } from '@/entrypoints/popup/styles';
import { usePauseCardMutation, useRemoveCardMutation } from '@/hooks/queries/cards';
import { useTimedConfirmation } from '@/hooks/useTimedConfirmation';
import type { Card } from '@/shared/cards';
import type { Translations } from '@/shared/i18n';
import { useI18n } from '../../../contexts/I18nContext';
import { CardNotes } from './CardNotes';

const getStateLabel = (state: FsrsState, t: Translations) => {
  switch (state) {
    case FsrsState.New:
      return t.states.new;
    case FsrsState.Learning:
      return t.states.learning;
    case FsrsState.Review:
      return t.states.review;
    case FsrsState.Relearning:
      return t.states.relearning;
    default:
      return t.states.unknown;
  }
};

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Easy':
      return 'text-green-500';
    case 'Medium':
      return 'text-yellow-500';
    case 'Hard':
      return 'text-red-500';
    default:
      return 'text-secondary';
  }
};

interface StatRowProps {
  label: string;
  value: string | number;
}

function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex justify-between">
      <span className="text-secondary">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

interface CardListItemProps {
  card: Card;
  isExpanded: boolean;
  onToggle: () => void;
  onDeleted: () => void;
}

export function CardListItem({ card, isExpanded, onToggle, onDeleted }: CardListItemProps) {
  const t = useI18n();
  const pauseCardMutation = usePauseCardMutation();
  const removeCardMutation = useRemoveCardMutation();
  const { isConfirming, startOrConfirm } = useTimedConfirmation();

  const handlePauseToggle = async () => {
    try {
      await pauseCardMutation.mutateAsync({ slug: card.slug, paused: !card.paused });
    } catch (error) {
      console.error('Failed to toggle pause status:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await removeCardMutation.mutateAsync(card.slug);
      onDeleted();
    } catch (error) {
      console.error('Failed to delete card:', error);
    }
  };

  return (
    <div className="bg-secondary rounded-lg border border-current overflow-hidden">
      <div className="flex items-center hover:bg-tertiary transition-colors">
        <Button
          className="flex-1 flex items-center justify-between p-3 text-left"
          onPress={onToggle}
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-2">
            {card.paused && <FaCirclePause className="text-warning text-base" title={t.cardsView.cardPausedTitle} />}
            <span className="text-xs text-secondary">{t.format.leetcodeId(card.leetcodeId)}</span>
            <span className={`text-sm ${card.paused ? 'opacity-60' : ''}`}>{card.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${getDifficultyColor(card.difficulty)}`}>{card.difficulty}</span>
            <span
              className={`text-xs text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            >
              ▶
            </span>
          </div>
        </Button>
        <a
          href={getLeetcodeProblemUrl(card)}
          target="_blank"
          rel="noopener noreferrer"
          className="self-stretch flex items-center px-3 text-secondary hover:text-primary transition-colors"
          aria-label={`Open ${card.name} on LeetCode`}
        >
          <FaArrowUpRightFromSquare className="text-sm" />
        </a>
      </div>

      {isExpanded && (
        <div className="px-4 pb-3 border-t border-current">
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <StatRow label={t.cardStats.state} value={getStateLabel(card.fsrs.state, t)} />
            <StatRow label={t.cardStats.reviews} value={card.fsrs.reps} />
            <StatRow label={t.cardStats.stability} value={t.format.stabilityDays(card.fsrs.stability.toFixed(1))} />
            <StatRow label={t.cardStats.lapses} value={card.fsrs.lapses} />
            <StatRow label={t.cardStats.difficulty} value={card.fsrs.difficulty.toFixed(2)} />
            <StatRow label={t.cardStats.due} value={formatDate(card.fsrs.due)} />
            {card.fsrs.last_review && <StatRow label={t.cardStats.last} value={formatDate(card.fsrs.last_review)} />}
            <StatRow label={t.cardStats.added} value={formatDate(card.createdAt)} />
          </div>

          <div className="mt-3 pt-3 border-t border-current flex gap-2">
            <Button
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs bg-tertiary text-primary hover:bg-quaternary transition-colors ${bounceButton} disabled:opacity-50`}
              onPress={handlePauseToggle}
              isDisabled={pauseCardMutation.isPending}
            >
              {card.paused ? <FaPlay className="text-sm" /> : <FaCirclePause className="text-sm" />}
              <span>{card.paused ? t.actions.resume : t.actions.pause}</span>
            </Button>

            <Button
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs ${
                isConfirming ? 'bg-ultra-danger' : 'bg-danger'
              } text-white hover:opacity-90 transition-colors ${bounceButton} disabled:opacity-50`}
              onPress={() => startOrConfirm(handleDelete)}
              isDisabled={removeCardMutation.isPending}
            >
              <FaTrash className="text-sm" />
              <span>{isConfirming ? t.actions.confirm : t.actions.delete}</span>
            </Button>
          </div>

          <CardNotes cardId={card.id} />
        </div>
      )}
    </div>
  );
}
