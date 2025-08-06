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
  useAnimationsEnabledQuery,
} from '@/hooks/useBackgroundQueries';
import type { Card } from '@/shared/cards';
import type { Grade } from 'ts-fsrs';

export function ReviewQueue() {
  const { data: animationsEnabled = true } = useAnimationsEnabledQuery();
  const { data: initialQueue, isLoading, error } = useReviewQueueQuery({ refetchOnWindowFocus: true });
  const rateCardMutation = useRateCardMutation();
  const removeCardMutation = useRemoveCardMutation();
  const delayCardMutation = useDelayCardMutation();
  const pauseCardMutation = usePauseCardMutation();
  const [queue, setQueue] = useState<Card[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isFirstCard, setIsFirstCard] = useState(true);

  // Effect to populate the local queue from the server-fetched queue.
  // This runs initially and whenever the local queue becomes empty,
  // but only if the server actually has cards to offer. This approach is
  // declarative and works seamlessly with the data-fetching library's cache.
  useEffect(() => {
    if (initialQueue && queue.length === 0 && initialQueue.length > 0) {
      setQueue([...initialQueue]);
    }
  }, [initialQueue, queue.length]);

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

      if (animationsEnabled && options.getSlideDirection) {
        const direction = options.getSlideDirection(result);
        if (direction) setSlideDirection(direction);
      }

      const animationDelay = animationsEnabled ? 400 : 0;
      setTimeout(() => {
        setQueue(options.updateQueue(result, restOfQueue));
        setSlideDirection(null);
        setIsProcessing(false);
        setIsFirstCard(false);
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

  // If the local queue is empty (and we're not loading), it means the user
  // has finished their session or there were no cards to begin with.
  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-3 px-4">
        <div className="text-xl font-semibold text-primary">No cards to review!</div>
        <div className="text-base text-secondary text-center">
          Add problems on LeetCode using the{' '}
          <svg
            className="inline-block mx-1 align-text-bottom"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#10b981' }}
          >
            <path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5" />
            <path d="M5.63 7.16l0 .01" />
            <path d="M4.06 11l0 .01" />
            <path d="M4.63 15.1l0 .01" />
            <path d="M7.16 18.37l0 .01" />
            <path d="M11 19.94l0 .01" />
          </svg>
          button next to &apos;Submit&apos;.
        </div>
      </div>
    );
  }

  const currentCard = queue[0];

  const getAnimationClass = () => {
    if (!animationsEnabled) return '';

    const baseClasses = 'transition-all duration-300 ease-out';

    if (slideDirection === 'left') {
      return `${baseClasses} animate-slide-left`;
    }
    if (slideDirection === 'right') {
      return `${baseClasses} animate-slide-right`;
    }
    // Skip pop-in animation for the first card of a new batch
    if (isFirstCard) {
      return '';
    }
    return `${baseClasses} animate-slide-in`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className={getAnimationClass()}>
        {/* The key is important to ensure React re-mounts the component for a new card */}
        <ReviewCard key={currentCard.id} card={currentCard} onRate={handleRating} isProcessing={isProcessing} />
      </div>
      <NotesSection cardId={currentCard.id} />
      <ActionsSection onDelete={handleDelete} onDelay={handleDelay} onPause={handlePause} />
    </div>
  );
}
