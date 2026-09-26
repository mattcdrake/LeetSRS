import { type ReactNode, useId, useState } from 'react';
import { LuCheck } from 'react-icons/lu';
import { EmptyState } from '@/popup/components/EmptyState';
import { NoteEditor } from '@/popup/components/notes/NoteEditor';
import {
  type CardWithProblem,
  useDelayCardMutation,
  usePauseCardMutation,
  useRateCardMutation,
  useRemoveCardMutation,
  useReviewQueueQuery,
} from '@/popup/queries/cards';
import { useI18n } from '../../contexts/I18nContext';
import { ActionsSection } from './ActionsSection';
import { ReviewCard } from './ReviewCard';

export function ReviewQueue({ emptyContent }: { emptyContent?: ReactNode }) {
  const t = useI18n();
  const { data: queue = [], isLoading, error } = useReviewQueueQuery();
  const rateCardMutation = useRateCardMutation();
  const removeCardMutation = useRemoveCardMutation();
  const delayCardMutation = useDelayCardMutation();
  const pauseCardMutation = usePauseCardMutation();
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const notesId = useId();
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
      emptyContent ?? (
        <EmptyState
          icon={<LuCheck aria-hidden="true" className="size-4" strokeWidth={2.2} />}
          title={t.home.caughtUp}
          description={t.home.caughtUpDescription}
        />
      )
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-0.5 text-[11px] font-medium text-tertiary">
        <span>{t.home.upNext}</span>
        <span className="font-normal tabular-nums">{t.home.queuePosition(1, queue.length)}</span>
      </div>
      {/* The key is important to ensure React re-mounts the component for a new card */}
      <ReviewCard
        key={currentCard.frontendId}
        card={currentCard}
        onRate={(rating) =>
          act((card) => rateCardMutation.mutateAsync({ frontendId: card.frontendId, domain: card.domain, rating }))
        }
        isProcessing={isProcessing}
      >
        <ActionsSection
          key={currentCard.frontendId}
          notesId={notesId}
          notesOpen={notesOpen}
          onToggleNotes={() => setNotesOpen((open) => !open)}
          youtubeUrl={currentCard.youtubeUrl}
          onDelete={() => act((card) => removeCardMutation.mutateAsync(card.frontendId))}
          onDelay={(days) => act((card) => delayCardMutation.mutateAsync({ frontendId: card.frontendId, days }))}
          onPause={() => act((card) => pauseCardMutation.mutateAsync({ frontendId: card.frontendId, paused: true }))}
          isDisabled={isProcessing}
        />
        {/* Hidden rather than unmounted so an unsaved draft survives closing the editor. */}
        <div id={notesId} className="pt-1 pb-2.5" hidden={!notesOpen}>
          <NoteEditor frontendId={currentCard.frontendId} variant="regular" isDisabled={isProcessing} />
        </div>
      </ReviewCard>
    </div>
  );
}
