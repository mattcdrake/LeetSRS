import { useState, useEffect } from 'react';
import { ReviewCard } from './ReviewCard';
import { NotesSection } from './NotesSection';
import { useReviewQueueQuery, useRateCardMutation } from '@/hooks/useBackgroundQueries';
import type { Card } from '@/shared/cards';
import type { Grade } from 'ts-fsrs';

interface ReviewQueueProps {
  disableAnimations?: boolean;
}

export function ReviewQueue({ disableAnimations = false }: ReviewQueueProps) {
  const { data: initialQueue, isLoading, error } = useReviewQueueQuery();
  const rateCardMutation = useRateCardMutation();
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

  const handleRating = async (rating: Grade) => {
    if (queue.length === 0 || isProcessing) return;

    setIsProcessing(true);

    const currentCard = queue[0];
    const restOfQueue = queue.slice(1);

    try {
      const result = await rateCardMutation.mutateAsync({
        slug: currentCard.slug,
        name: currentCard.name,
        rating,
        leetcodeId: currentCard.leetcodeId,
        difficulty: currentCard.difficulty,
      });

      // Set slide direction based on actual outcome, not rating
      if (!disableAnimations) {
        if (result.shouldRequeue) {
          setSlideDirection('left'); // Card will be seen again today (back of queue)
        } else {
          setSlideDirection('right'); // Card is done for today (removed from queue)
        }
      }

      // Wait for animation to complete, then update queue
      const animationDelay = disableAnimations ? 0 : 400;
      setTimeout(() => {
        if (result.shouldRequeue) {
          const updatedCard = result.card;
          const newQueue = [...restOfQueue, updatedCard];
          setQueue(newQueue);
        } else {
          setQueue([...restOfQueue]);
        }
        setSlideDirection(null);
        setIsProcessing(false);
      }, animationDelay);
    } catch (error) {
      console.error('Failed to rate card:', error);
      setSlideDirection(null);
      setIsProcessing(false);
    }
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
    <div className="flex flex-col gap-4 overflow-hidden">
      <div className={getAnimationClass()}>
        <ReviewCard key={currentCard.id} card={currentCard} onRate={handleRating} isProcessing={isProcessing} />
      </div>
      <NotesSection cardId={currentCard.id} />
    </div>
  );
}
