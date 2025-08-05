import { useState, useEffect } from 'react';
import { ReviewCard } from './ReviewCard';
import { NotesSection } from './NotesSection';
import { ActionsSection } from './ActionsSection';
import {
  useReviewQueueQuery,
  useRateCardMutation,
  useRemoveCardMutation,
  useDelayCardMutation,
  usePauseCardMutation,
} from '@/hooks/useBackgroundQueries';
import type { Card } from '@/shared/cards';
import type { Grade } from 'ts-fsrs';

interface ReviewQueueProps {
  disableAnimations?: boolean;
}

export function ReviewQueue({ disableAnimations = false }: ReviewQueueProps) {
  const { data: initialQueue, isLoading, error } = useReviewQueueQuery();
  const rateCardMutation = useRateCardMutation();
  const removeCardMutation = useRemoveCardMutation();
  const delayCardMutation = useDelayCardMutation();
  const pauseCardMutation = usePauseCardMutation();
  const [queue, setQueue] = useState<Card[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

  // Initialize queue only once when data first loads
  useEffect(() => {
    if (initialQueue && !hasInitialized) {
      setQueue([...initialQueue]);
      setHasInitialized(true);
    }
  }, [initialQueue, hasInitialized]);

  const handleCardAction = async <T,>(
    action: () => Promise<T>,
    options: {
      getSlideDirection?: (result: T) => 'left' | 'right' | null;
      updateQueue: (result: T, restOfQueue: Card[]) => Card[];
      errorMessage: string;
    }
  ) => {
    if (queue.length === 0 || isProcessing) return;

    setIsProcessing(true);
    const restOfQueue = queue.slice(1);

    try {
      const result = await action();

      if (!disableAnimations && options.getSlideDirection) {
        const direction = options.getSlideDirection(result);
        if (direction) setSlideDirection(direction);
      }

      const animationDelay = disableAnimations ? 0 : 400;
      setTimeout(() => {
        setQueue(options.updateQueue(result, restOfQueue));
        setSlideDirection(null);
        setIsProcessing(false);
      }, animationDelay);
    } catch (error) {
      console.error(options.errorMessage, error);
      setSlideDirection(null);
      setIsProcessing(false);
    }
  };

  const handleRating = async (rating: Grade) => {
    const currentCard = queue[0];
    await handleCardAction(
      () =>
        rateCardMutation.mutateAsync({
          slug: currentCard.slug,
          name: currentCard.name,
          rating,
          leetcodeId: currentCard.leetcodeId,
          difficulty: currentCard.difficulty,
        }),
      {
        getSlideDirection: (result) => (result.shouldRequeue ? 'left' : 'right'),
        updateQueue: (result, restOfQueue) => {
          return result.shouldRequeue ? [...restOfQueue, result.card] : restOfQueue;
        },
        errorMessage: 'Failed to rate card:',
      }
    );
  };

  const handleDelete = async () => {
    const currentCard = queue[0];
    await handleCardAction(() => removeCardMutation.mutateAsync(currentCard.slug), {
      getSlideDirection: () => 'left',
      updateQueue: (_, restOfQueue) => restOfQueue,
      errorMessage: 'Failed to delete card:',
    });
  };

  const handleDelay = async (days: number) => {
    const currentCard = queue[0];
    await handleCardAction(() => delayCardMutation.mutateAsync({ slug: currentCard.slug, days }), {
      getSlideDirection: () => 'right',
      updateQueue: (_, restOfQueue) => restOfQueue,
      errorMessage: 'Failed to delay card:',
    });
  };

  const handlePause = async () => {
    const currentCard = queue[0];
    await handleCardAction(() => pauseCardMutation.mutateAsync({ slug: currentCard.slug, paused: true }), {
      getSlideDirection: () => 'right',
      updateQueue: (_, restOfQueue) => restOfQueue,
      errorMessage: 'Failed to pause card:',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-secondary">Loading review queue...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-red-500">Failed to load review queue</div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <div className="text-lg font-semibold text-primary">No cards to review!</div>
        <div className="text-sm text-secondary">Check back tomorrow for more reviews.</div>
      </div>
    );
  }

  const currentCard = queue[0];

  const getAnimationClass = () => {
    if (disableAnimations) return '';

    const baseClasses = 'transition-all duration-300 ease-out';

    if (slideDirection === 'left') {
      return `${baseClasses} animate-slide-left`;
    }
    if (slideDirection === 'right') {
      return `${baseClasses} animate-slide-right`;
    }
    return `${baseClasses} animate-slide-in`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className={getAnimationClass()}>
        <ReviewCard key={currentCard.id} card={currentCard} onRate={handleRating} isProcessing={isProcessing} />
      </div>
      <NotesSection cardId={currentCard.id} />
      <ActionsSection onDelete={handleDelete} onDelay={handleDelay} onPause={handlePause} />
    </div>
  );
}
