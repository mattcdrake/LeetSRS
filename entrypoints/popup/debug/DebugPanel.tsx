import { useState } from 'react';
import { useCardsQuery, useAddCardMutation, useRemoveCardMutation } from '@/hooks/useBackgroundQueries';
import { DebugCard } from './DebugCard';
import { ReviewQueue } from './ReviewQueue';
import { TodayStats } from './TodayStats';
import './DebugPanel.css';

export function DebugPanel() {
  const [slug, setSlug] = useState('');
  const [isCardsCollapsed, setIsCardsCollapsed] = useState(false);

  const { data: cards, isLoading: isLoadingCards, error: cardsError } = useCardsQuery();
  const addCardMutation = useAddCardMutation();
  const removeCardMutation = useRemoveCardMutation();

  const cardsList = cards ?? [];

  const handleAddCard = async () => {
    if (!slug.trim()) return;

    try {
      await addCardMutation.mutateAsync({
        slug: slug.trim(),
        name: slug.trim(), // Using slug as name for debug purposes
      });
      setSlug('');
    } catch (error) {
      console.error('Failed to add card:', error);
    }
  };

  const handleRemoveCard = async (slug: string) => {
    try {
      await removeCardMutation.mutateAsync(slug);
    } catch (error) {
      console.error('Failed to remove card:', error);
    }
  };

  return (
    <div className="debug-panel">
      <h2 className="debug-panel-title">🔧 DEBUG PANEL</h2>

      <div className="debug-panel-input-container">
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCard()}
          placeholder="Enter card slug (e.g., two-sum)"
          className="debug-panel-input"
        />
        <button
          onClick={handleAddCard}
          disabled={addCardMutation.isPending || !slug.trim()}
          className="debug-panel-button"
        >
          {addCardMutation.isPending ? 'Adding...' : 'Add Card'}
        </button>
      </div>

      <div>
        <h3
          className="debug-panel-cards-header"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setIsCardsCollapsed(!isCardsCollapsed)}
        >
          <span style={{ marginRight: '8px' }}>{isCardsCollapsed ? '▶' : '▼'}</span>
          Cards in Storage ({cardsList.length})
        </h3>
        {!isCardsCollapsed &&
          (isLoadingCards ? (
            <p className="debug-panel-empty-state">Loading cards...</p>
          ) : cardsError ? (
            <p className="debug-panel-empty-state">Error loading cards: {cardsError.message}</p>
          ) : cardsList.length === 0 ? (
            <p className="debug-panel-empty-state">No cards in storage</p>
          ) : (
            <div className="debug-panel-cards-container">
              {cardsList.map((card) => (
                <DebugCard key={card.slug} card={card} onRemove={handleRemoveCard} />
              ))}
            </div>
          ))}
      </div>

      <ReviewQueue style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }} />

      <TodayStats style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }} />
    </div>
  );
}
