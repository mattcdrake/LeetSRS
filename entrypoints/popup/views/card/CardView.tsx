import { useState } from 'react';
import { ViewLayout } from '../../components/ViewLayout';
import { StreakCounter } from '../../components/StreakCounter';
import { CardNotes } from './components/CardNotes';
import { useCardsQuery, usePauseCardMutation, useRemoveCardMutation } from '@/hooks/useBackgroundQueries';
import { Button, TextField, Input, Label } from 'react-aria-components';
import { State as FsrsState } from 'ts-fsrs';
import type { Card } from '@/shared/cards';
import { FaCirclePause, FaPlay, FaTrash, FaXmark, FaMagnifyingGlass } from 'react-icons/fa6';
import { bounceButton } from '@/shared/styles';
import { useI18n } from '../../contexts/I18nContext';
import type { Translations } from '@/shared/i18n';

// Utility functions
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

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

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

// Sub-components
interface CardHeaderProps {
  card: Card;
  isExpanded: boolean;
  t: Translations;
}

function CardHeader({ card, isExpanded, t }: CardHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        {card.paused && <FaCirclePause className="text-warning text-base" title={t.cardsView.cardPausedTitle} />}
        <span className="text-xs text-secondary">{t.format.leetcodeId(card.leetcodeId)}</span>
        <span className={`text-sm ${card.paused ? 'opacity-60' : ''}`}>{card.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs ${getDifficultyColor(card.difficulty)}`}>{card.difficulty}</span>
        <span className={`text-xs text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </div>
    </>
  );
}

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

interface CardStatsProps {
  card: Card;
  cardId: string;
  onPauseToggle: () => void;
  onDelete: () => void;
  isPauseProcessing: boolean;
  isDeleteProcessing: boolean;
  t: Translations;
}

function CardStats({
  card,
  cardId,
  onPauseToggle,
  onDelete,
  isPauseProcessing,
  isDeleteProcessing,
  t,
}: CardStatsProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
    } else {
      onDelete();
      setDeleteConfirm(false);
    }
  };

  return (
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
          onPress={onPauseToggle}
          isDisabled={isPauseProcessing}
        >
          {card.paused ? <FaPlay className="text-sm" /> : <FaCirclePause className="text-sm" />}
          <span>{card.paused ? t.actions.resume : t.actions.pause}</span>
        </Button>

        <Button
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs ${
            deleteConfirm ? 'bg-ultra-danger' : 'bg-danger'
          } text-white hover:opacity-90 transition-colors ${bounceButton} disabled:opacity-50`}
          onPress={handleDelete}
          isDisabled={isDeleteProcessing}
        >
          <FaTrash className="text-sm" />
          <span>{deleteConfirm ? t.actions.confirm : t.actions.delete}</span>
        </Button>
      </div>

      <CardNotes cardId={cardId} />
    </div>
  );
}

interface CardItemProps {
  card: Card;
  isExpanded: boolean;
  onToggle: () => void;
  onPauseToggle: () => void;
  onDelete: () => void;
  isPauseProcessing: boolean;
  isDeleteProcessing: boolean;
  t: Translations;
}

function CardItem({
  card,
  isExpanded,
  onToggle,
  onPauseToggle,
  onDelete,
  isPauseProcessing,
  isDeleteProcessing,
  t,
}: CardItemProps) {
  return (
    <div className="bg-secondary rounded-lg border border-current overflow-hidden">
      <Button
        className="w-full flex items-center justify-between p-3 hover:bg-tertiary transition-colors text-left"
        onPress={onToggle}
        aria-expanded={isExpanded}
      >
        <CardHeader card={card} isExpanded={isExpanded} t={t} />
      </Button>
      {isExpanded && (
        <CardStats
          card={card}
          cardId={card.id}
          onPauseToggle={onPauseToggle}
          onDelete={onDelete}
          isPauseProcessing={isPauseProcessing}
          isDeleteProcessing={isDeleteProcessing}
          t={t}
        />
      )}
    </div>
  );
}

export function CardView() {
  const t = useI18n();
  const { data: cards = [], isLoading } = useCardsQuery();
  const pauseCardMutation = usePauseCardMutation();
  const removeCardMutation = useRemoveCardMutation();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [processingCards, setProcessingCards] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');

  const filteredCards = cards.filter((card) => {
    if (!filterText) return true;
    const searchLower = filterText.toLowerCase();
    return card.name.toLowerCase().includes(searchLower) || card.leetcodeId.includes(filterText);
  });

  const sortedCards = [...filteredCards].sort((a, b) => {
    const aId = parseInt(a.leetcodeId);
    const bId = parseInt(b.leetcodeId);
    return aId - bId;
  });

  const toggleCard = (cardId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const handlePauseToggle = async (card: Card) => {
    setProcessingCards((prev) => new Set(prev).add(card.id));
    try {
      await pauseCardMutation.mutateAsync({ slug: card.slug, paused: !card.paused });
    } catch (error) {
      console.error('Failed to toggle pause status:', error);
    } finally {
      setProcessingCards((prev) => {
        const newSet = new Set(prev);
        newSet.delete(card.id);
        return newSet;
      });
    }
  };

  const handleDelete = async (card: Card) => {
    setProcessingCards((prev) => new Set(prev).add(card.id));
    try {
      await removeCardMutation.mutateAsync(card.slug);
      // Remove from expanded cards if it was expanded
      setExpandedCards((prev) => {
        const newSet = new Set(prev);
        newSet.delete(card.id);
        return newSet;
      });
    } catch (error) {
      console.error('Failed to delete card:', error);
    } finally {
      setProcessingCards((prev) => {
        const newSet = new Set(prev);
        newSet.delete(card.id);
        return newSet;
      });
    }
  };

  return (
    <ViewLayout title={t.cardsView.title} headerContent={<StreakCounter />}>
      <div className="flex flex-col gap-4">
        {!isLoading && cards.length > 0 && (
          <TextField className="relative" value={filterText} onChange={setFilterText}>
            <Label className="sr-only">{t.cardsView.filterAriaLabel}</Label>
            <div className="relative">
              <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm" />
              <Input
                className="w-full pl-9 pr-9 py-2 bg-secondary rounded-lg border border-current text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder={t.cardsView.filterPlaceholder}
              />
              {filterText && (
                <Button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-tertiary transition-colors"
                  onPress={() => setFilterText('')}
                  aria-label={t.cardsView.clearFilterAriaLabel}
                >
                  <FaXmark className="text-secondary text-sm" />
                </Button>
              )}
            </div>
          </TextField>
        )}

        {isLoading ? (
          <p className="text-secondary">{t.cardsView.loadingCards}</p>
        ) : cards.length === 0 ? (
          <p className="text-secondary">{t.cardsView.noCardsAdded}</p>
        ) : sortedCards.length === 0 ? (
          <p className="text-secondary">{t.cardsView.noCardsMatchFilter}</p>
        ) : (
          <div className="space-y-2">
            {sortedCards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                isExpanded={expandedCards.has(card.id)}
                onToggle={() => toggleCard(card.id)}
                onPauseToggle={() => handlePauseToggle(card)}
                onDelete={() => handleDelete(card)}
                isPauseProcessing={processingCards.has(card.id) && pauseCardMutation.isPending}
                isDeleteProcessing={processingCards.has(card.id) && removeCardMutation.isPending}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </ViewLayout>
  );
}
