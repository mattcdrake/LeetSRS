import { useState, useEffect } from 'react';
import type { Card } from '@/services/cards';
import { sendMessage, MessageType } from '@/services/messages';
import './DebugPanel.css';

export function DebugPanel() {
  const [slug, setSlug] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);

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
          disabled={loading || !slug.trim()}
          className="debug-panel-button"
        >
          {loading ? 'Adding...' : 'Add Card'}
        </button>
      </div>

      <div>
        <h3 className="debug-panel-cards-header">Cards in Storage ({cards.length})</h3>
        {cards.length === 0 ? (
          <p className="debug-panel-empty-state">No cards in storage</p>
        ) : (
          <div className="debug-panel-cards-container">
            {cards.map((card) => (
              <div key={card.id} className="debug-panel-card">
                <div className="debug-panel-card-label">
                  <strong>ID:</strong> <span className="debug-panel-card-value">{card.id}</span>
                </div>
                <div className="debug-panel-card-label">
                  <strong>Slug:</strong> <span className="debug-panel-card-value">{card.slug}</span>
                </div>
                <div className="debug-panel-card-label">
                  <strong>Name:</strong> <span className="debug-panel-card-value">{card.name}</span>
                </div>
                <div className="debug-panel-card-label">
                  <strong>Created:</strong>{' '}
                  <span className="debug-panel-card-value">{new Date(card.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
