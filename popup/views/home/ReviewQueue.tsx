import { useState } from 'react';
import type { Grade } from 'ts-fsrs';
import type { RateCardInput } from '@/domain/cards';
import {
  useDelayCardMutation,
  usePauseCardMutation,
  useRateCardMutation,
  useRemoveCardMutation,
  useReviewQueueQuery,
} from '@/popup/queries/cards';
import { LeetSRSLogo } from '../../components/LeetSRSLogo';
import { useI18n } from '../../contexts/I18nContext';
import { ActionsSection } from './ActionsSection';
import { NotesSection } from './NotesSection';
import { ReviewCard } from './ReviewCard';

export function ReviewQueue() {
  const t = useI18n();
  const { data: queue = [], isLoading, error } = useReviewQueueQuery({ refetchOnWindowFocus: true });
  const rateCardMutation = useRateCardMutation();
  const removeCardMutation = useRemoveCardMutation();
  const delayCardMutation = useDelayCardMutation();
  const pauseCardMutation = usePauseCardMutation();
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const isProcessing = processingCardId !== null;

  const handleCardAction = async (action: () => Promise<void>, errorMessage: string) => {
    if (queue.length === 0 || isProcessing) return;

    setProcessingCardId(queue[0].id);

    try {
      await action();
    } catch (error) {
      console.error(errorMessage, error);
    } finally {
      setProcessingCardId(null);
    }
  };

  const handleRating = async (rating: Grade) => {
    const currentCard = queue[0];
    const input: RateCardInput = {
      slug: currentCard.slug,
      name: currentCard.name,
      leetcodeId: currentCard.leetcodeId,
      difficulty: currentCard.difficulty,
      domain: currentCard.domain,
      rating,
    };
    await handleCardAction(() => rateCardMutation.mutateAsync(input), 'Failed to rate card:');
  };

  const handleDelete = async () => {
    const currentCard = queue[0];
    await handleCardAction(() => removeCardMutation.mutateAsync(currentCard.slug), 'Failed to delete card:');
  };

  const handleDelay = async (days: number) => {
    const currentCard = queue[0];
    await handleCardAction(
      () => delayCardMutation.mutateAsync({ slug: currentCard.slug, days }),
      'Failed to delay card:'
    );
  };

  const handlePause = async () => {
    const currentCard = queue[0];
    await handleCardAction(
      () => pauseCardMutation.mutateAsync({ slug: currentCard.slug, paused: true }),
      'Failed to pause card:'
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-secondary">{t.home.loadingReviewQueue}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-red-500">{t.errors.failedToLoadReviewQueue}</div>
      </div>
    );
  }

  const currentCard = queue[0];

  if (processingCardId && currentCard?.id !== processingCardId) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-secondary">{t.home.loadingReviewQueue}</div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-3 px-4">
        <div className="text-xl font-semibold text-primary">{t.home.noCardsToReview}</div>
        <div className="text-base text-secondary text-center">
          {t.home.addProblemsInstructions} <LeetSRSLogo />
          {t.home.addProblemsButton}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The key is important to ensure React re-mounts the component for a new card */}
      <ReviewCard key={currentCard.id} card={currentCard} onRate={handleRating} isProcessing={isProcessing} />
      <NotesSection slug={currentCard.slug} isDisabled={isProcessing} />
      <ActionsSection onDelete={handleDelete} onDelay={handleDelay} onPause={handlePause} isDisabled={isProcessing} />
    </div>
  );
}
