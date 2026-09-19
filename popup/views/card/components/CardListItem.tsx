import { useState } from 'react';
import { Button } from 'react-aria-components';
import { FaArrowUpRightFromSquare, FaChevronRight, FaCirclePause, FaPlay, FaTrash } from 'react-icons/fa6';
import { State as FsrsState } from 'ts-fsrs';
import { NoteEditor } from '@/popup/components/notes/NoteEditor';
import { useTimedConfirmation } from '@/popup/hooks/useTimedConfirmation';
import type { CardWithProblem } from '@/popup/queries/cards';
import { usePauseCardMutation, useRemoveCardMutation } from '@/popup/queries/cards';
import { destructiveButton, rowActionSpacing, secondaryButton } from '@/popup/styles';
import type { Translations } from '@/shared/i18n/index';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import { DIFFICULTY_COLORS } from '@/shared/ui/difficulty-colors';
import { getProblemTitle } from '@/shared/ui/problem-title';
import { YouTubeLink } from '@/shared/ui/YouTubeLink';
import { useI18n } from '../../../contexts/I18nContext';

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

const formatDate = (date: number) =>
  new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

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
  card: CardWithProblem;
}

export function CardListItem({ card }: CardListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = useI18n();
  const pauseCardMutation = usePauseCardMutation();
  const removeCardMutation = useRemoveCardMutation();
  const { isConfirming, startOrConfirm } = useTimedConfirmation();

  const handlePauseToggle = async () => {
    try {
      await pauseCardMutation.mutateAsync({ frontendId: card.frontendId, paused: !card.paused });
    } catch (error) {
      console.error('Failed to toggle pause status:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await removeCardMutation.mutateAsync(card.frontendId);
    } catch (error) {
      console.error('Failed to delete card:', error);
    }
  };

  return (
    <div className="text-primary">
      <div className="flex items-center gap-2 rounded-lg hover:bg-secondary transition-colors">
        <Button
          className="min-w-0 flex-1 flex items-center min-h-10 py-2 text-left rounded-lg cursor-pointer focus-visible:outline-2"
          onPress={() => setIsExpanded((expanded) => !expanded)}
          aria-expanded={isExpanded}
        >
          <div className="flex min-w-0 items-center gap-2">
            <FaChevronRight
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            />
            {card.paused && <FaCirclePause className="text-warning text-base" title={t.cardsView.cardPausedTitle} />}
            <span className="text-xs text-secondary">{t.format.leetcodeId(card.frontendId)}</span>
            <span className={`min-w-0 break-words text-sm ${card.paused ? 'opacity-60' : ''}`}>
              {getProblemTitle(card, card.domain)}
            </span>
          </div>
        </Button>
        <div className={`flex shrink-0 items-center ${rowActionSpacing}`}>
          <span
            className="px-2 text-xs text-secondary capitalize"
            style={{ color: DIFFICULTY_COLORS[card.difficulty] }}
          >
            {card.difficulty}
          </span>
          <YouTubeLink url={card.youtubeUrl} label={t.youtubeSolution} />
          <a
            href={getLeetcodeProblemUrl(card)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary transition-colors focus-visible:outline-2"
            aria-label={`Open ${getProblemTitle(card, card.domain)} on LeetCode`}
          >
            <FaArrowUpRightFromSquare aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 py-3 rounded-lg bg-secondary">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <StatRow label={t.cardStats.state} value={getStateLabel(card.fsrs.state, t)} />
            <StatRow label={t.cardStats.reviews} value={card.fsrs.reps} />
            <StatRow label={t.cardStats.stability} value={t.format.stabilityDays(card.fsrs.stability.toFixed(1))} />
            <StatRow label={t.cardStats.lapses} value={card.fsrs.lapses} />
            <StatRow label={t.cardStats.difficulty} value={card.fsrs.difficulty.toFixed(2)} />
            <StatRow label={t.cardStats.due} value={formatDate(card.fsrs.due)} />
            {card.fsrs.last_review !== undefined && (
              <StatRow label={t.cardStats.last} value={formatDate(card.fsrs.last_review)} />
            )}
            <StatRow label={t.cardStats.added} value={formatDate(card.createdAt)} />
          </div>

          <div className="mt-3 pt-3 border-t border-current flex gap-2">
            <Button
              className={`flex-1 flex items-center justify-center gap-2 ${secondaryButton}`}
              onPress={handlePauseToggle}
              isDisabled={pauseCardMutation.isPending}
            >
              {card.paused ? <FaPlay className="text-sm" /> : <FaCirclePause className="text-sm" />}
              <span>{card.paused ? t.actions.resume : t.actions.pause}</span>
            </Button>

            <Button
              className={`flex-1 flex items-center justify-center gap-2 ${destructiveButton(isConfirming)}`}
              onPress={() => startOrConfirm(handleDelete)}
              isDisabled={removeCardMutation.isPending}
            >
              <FaTrash className="text-sm" />
              <span>{isConfirming ? t.actions.confirm : t.actions.delete}</span>
            </Button>
          </div>

          <div className="mt-3 pt-3 border-t border-current">
            <span className="text-xs text-secondary">{t.notes.title}</span>
            <NoteEditor frontendId={card.frontendId} variant="compact" />
          </div>
        </div>
      )}
    </div>
  );
}
