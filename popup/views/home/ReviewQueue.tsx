import { type ReactNode, useState } from 'react';
import { NoteEditor } from '@/popup/components/notes/NoteEditor';
import {
  type CardWithProblem,
  useDelayCardMutation,
  usePauseCardMutation,
  useRateCardMutation,
  useRemoveCardMutation,
  useReviewQueueQuery,
} from '@/popup/queries/cards';
import { LeetSRSLogo } from '@/shared/ui/LeetSRSLogo';
import { useI18n } from '../../contexts/I18nContext';
import { ActionsSection } from './ActionsSection';
import { ExpandableSection } from './ExpandableSection';
import { ReviewCard } from './ReviewCard';

export function ReviewQueue({ emptyContent }: { emptyContent?: ReactNode }) {
  const t = useI18n();
  const { data: queue = [], isLoading, error } = useReviewQueueQuery();
  const rateCardMutation = useRateCardMutation();
  const removeCardMutation = useRemoveCardMutation();
  const delayCardMutation = useDelayCardMutation();
  const pauseCardMutation = usePauseCardMutation();
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const isProcessing = processingCardId !== null;

  const currentCard = queue[0];

  const act = async (action: (card: CardWithProblem) => Promise<unknown>) => {
    if (!currentCard || isProcessing) return;

    setProcessingCardId(currentCard.frontendId);

    try {
      await action(currentCard);
    } catch (error) {
      console.error('Failed to update card:', error);
    } finally {
      setProcessingCardId(null);
    }
  };

  const loadingQueue = (
    <div className="flex items-center justify-center h-32">
      <div className="text-secondary">{t.home.loadingReviewQueue}</div>
    </div>
  );

  if (isLoading) return loadingQueue;

  if (error) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-red-500">{t.errors.failedToLoadReviewQueue}</div>
      </div>
    );
  }

  if (processingCardId && currentCard?.frontendId !== processingCardId) return loadingQueue;

  if (!currentCard) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-32 gap-3 px-4">
          <div className="text-xl font-semibold text-primary">{t.home.noCardsToReview}</div>
          <div className="text-base text-secondary text-center">
            {t.home.addProblemsInstructions}{' '}
            <LeetSRSLogo
              className="inline-block mx-1 align-text-bottom"
              width="20"
              height="20"
              style={{ color: '#10b981' }}
            />
            {t.home.addProblemsButton}
          </div>
        </div>
        {emptyContent}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The key is important to ensure React re-mounts the component for a new card */}
      <ReviewCard
        key={currentCard.frontendId}
        card={currentCard}
        onRate={(rating) =>
          act((card) => rateCardMutation.mutateAsync({ frontendId: card.frontendId, domain: card.domain, rating }))
        }
        isProcessing={isProcessing}
      />
      <div>
        <ExpandableSection title={t.notes.title} isDisabled={isProcessing}>
          <NoteEditor frontendId={currentCard.frontendId} variant="regular" isDisabled={isProcessing} />
        </ExpandableSection>
        <ExpandableSection title={t.actionsSection.title} isDisabled={isProcessing}>
          <ActionsSection
            key={currentCard.frontendId}
            youtubeUrl={currentCard.youtubeUrl}
            onDelete={() => act((card) => removeCardMutation.mutateAsync(card.frontendId))}
            onDelay={(days) => act((card) => delayCardMutation.mutateAsync({ frontendId: card.frontendId, days }))}
            onPause={() => act((card) => pauseCardMutation.mutateAsync({ frontendId: card.frontendId, paused: true }))}
            isDisabled={isProcessing}
          />
        </ExpandableSection>
      </div>
    </div>
  );
}
