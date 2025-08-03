import { useState, useEffect } from 'react';
import type { Card } from '@/services/cards';
import { sendMessage, MessageType } from '@/services/messages';
import { DebugCard } from './DebugCard';
import { ReviewQueue } from './ReviewQueue';
import { TodayStats } from './TodayStats';
import './DebugPanel.css';

export function DebugPanel() {
  const [slug, setSlug] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCardsCollapsed, setIsCardsCollapsed] = useState(false);

  // Load all cards on mount and after adding
  const loadCards = async () => {
    try {
      const cards = await sendMessage({ type: MessageType.GET_ALL_CARDS });
      if (cards) {
        setCards(cards);
      }
    } catch (error) {
      console.error('Failed to load cards:', error);
    }
  };

  useEffect(() => {
    loadCards();
  }, []);

  const handleAddCard = async () => {
    if (!slug.trim()) return;

    setLoading(true);
    try {
      const card = await sendMessage({
        type: MessageType.ADD_CARD,
        slug: slug.trim(),
        name: slug.trim(), // Using slug as name for debug purposes
      });

      if (card) {
        setSlug('');
        await loadCards(); // Reload cards after adding
      }
    } catch (error) {
      console.error('Failed to add card:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCard = async (slug: string) => {
    try {
      await sendMessage({
        type: MessageType.REMOVE_CARD,
        slug: slug,
      });
      await loadCards(); // Reload cards after removing
    } catch (error) {
      console.error('Failed to remove card:', error);
    }
  };

  const handleUpdateCard = (updatedCard: Card) => {
    setCards((prevCards) => prevCards.map((card) => (card.slug === updatedCard.slug ? updatedCard : card)));
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
        <button onClick={handleAddCard} disabled={loading || !slug.trim()} className="debug-panel-button">
          {loading ? 'Adding...' : 'Add Card'}
        </button>
      </div>

      <div>
        <h3
          className="debug-panel-cards-header"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setIsCardsCollapsed(!isCardsCollapsed)}
        >
          <span style={{ marginRight: '8px' }}>{isCardsCollapsed ? '▶' : '▼'}</span>
          Cards in Storage ({cards.length})
        </h3>
        {!isCardsCollapsed &&
          (cards.length === 0 ? (
            <p className="debug-panel-empty-state">No cards in storage</p>
          ) : (
            <div className="debug-panel-cards-container">
              {cards.map((card) => (
                <DebugCard key={card.slug} card={card} onRemove={handleRemoveCard} onUpdate={handleUpdateCard} />
              ))}
            </div>
          ))}
      </div>

      <ReviewQueue style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }} />

      <TodayStats style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }} />
    </div>
  );
}
