import { useState } from 'react';
import type { Grade } from 'ts-fsrs';
import { NoteEditor } from '@/popup/components/notes/NoteEditor';
import {
  useDelayCardMutation,
  usePauseCardMutation,
  useRateCardMutation,
  useRemoveCardMutation,
  useReviewQueueQuery,
} from '@/popup/queries/cards';
import type { RateCardInput } from '@/shared/models';
import { LeetSRSLogo } from '../../components/LeetSRSLogo';
import { useI18n } from '../../contexts/I18nContext';
import { ActionsSection } from './ActionsSection';
import { ExpandableSection } from './ExpandableSection';
import { ReviewCard } from './ReviewCard';

export function ReviewQueue() {
  const t = useI18n();
  const { data: queue = [], isLoading, error } = useReviewQueueQuery();
  const rateCardMutation = useRateCardMutation();
  const removeCardMutation = useRemoveCardMutation();
  const delayCardMutation = useDelayCardMutation();
  const pauseCardMutation = usePauseCardMutation();
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const isProcessing = processingCardId !== null;

  const handleCardAction = async (action: () => Promise<void>, errorMessage: string) => {
    if (queue.length === 0 || isProcessing) return;

    setProcessingCardId(queue[0].frontendId);

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
      frontendId: currentCard.frontendId,
      domain: currentCard.domain,
      rating,
    };
    await handleCardAction(() => rateCardMutation.mutateAsync(input), 'Failed to rate card:');
  };

  const handleDelete = async () => {
    const currentCard = queue[0];
    await handleCardAction(() => removeCardMutation.mutateAsync(currentCard.frontendId), 'Failed to delete card:');
  };

  const handleDelay = async (days: number) => {
    const currentCard = queue[0];
    await handleCardAction(
      () => delayCardMutation.mutateAsync({ frontendId: currentCard.frontendId, days }),
      'Failed to delay card:'
    );
  };

  const handlePause = async () => {
    const currentCard = queue[0];
    await handleCardAction(
      () => pauseCardMutation.mutateAsync({ frontendId: currentCard.frontendId, paused: true }),
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

  if (processingCardId && currentCard?.frontendId !== processingCardId) {
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
      <ReviewCard key={currentCard.frontendId} card={currentCard} onRate={handleRating} isProcessing={isProcessing} />
      <div>
        <ExpandableSection title={t.notes.title} isDisabled={isProcessing}>
          <NoteEditor frontendId={currentCard.frontendId} variant="regular" isDisabled={isProcessing} />
        </ExpandableSection>
        <ExpandableSection title={t.actionsSection.title} isDisabled={isProcessing}>
          <ActionsSection
            key={currentCard.frontendId}
            onDelete={handleDelete}
            onDelay={handleDelay}
            onPause={handlePause}
            isDisabled={isProcessing}
          />
        </ExpandableSection>
      </div>
    </div>
  );
}
