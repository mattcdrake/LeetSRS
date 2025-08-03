import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import type { Card } from '@/services/cards';

console.log('DebugPanel module loaded');

export function DebugPanel() {
  console.log('DebugPanel function called');
  
  const [slug, setSlug] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  const log = (message: string) => {
    console.log(message);
    setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Load all cards on mount and after adding
  const loadCards = async () => {
    log('Loading cards...');
    try {
      const response = await browser.runtime.sendMessage({ type: 'GET_ALL_CARDS' });
      log(`Received response: ${JSON.stringify(response)}`);
      if (response.success) {
        setCards(response.cards);
        log(`Cards loaded: ${response.cards.length} cards`);
      } else {
        log(`Failed: ${response.error}`);
      }
    } catch (error) {
      log(`Error loading cards: ${error}`);
    }
  };

  useEffect(() => {
    log('Component mounted');
    loadCards();
  }, []);

  const handleAddCard = async () => {
    if (!slug.trim()) return;
    
    log(`Adding card with slug: ${slug.trim()}`);
    setLoading(true);
    try {
      const response = await browser.runtime.sendMessage({ 
        type: 'ADD_CARD', 
        slug: slug.trim(),
        name: slug.trim() // Using slug as name for debug purposes
      });
      
      log(`Add card response: ${JSON.stringify(response)}`);
      if (response.success) {
        setSlug('');
        await loadCards(); // Reload cards after adding
      } else {
        log(`Failed to add card: ${response.error}`);
      }
    } catch (error) {
      log(`Error adding card: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      border: '2px dashed red', 
      borderRadius: '8px',
      marginTop: '20px',
      textAlign: 'left'
    }}>
      <h2 style={{ color: 'red', marginTop: 0 }}>🔧 DEBUG PANEL</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCard()}
          placeholder="Enter card slug (e.g., two-sum)"
          style={{ 
            padding: '8px', 
            marginRight: '10px',
            width: '250px',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}
        />
        <button 
          onClick={handleAddCard}
          disabled={loading || !slug.trim()}
          style={{ 
            padding: '8px 16px',
            borderRadius: '4px',
            background: loading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Adding...' : 'Add Card'}
        </button>
      </div>

      <div>
        <h3>Cards in Storage ({cards.length})</h3>
        {cards.length === 0 ? (
          <p style={{ color: '#666' }}>No cards in storage</p>
        ) : (
          <div style={{ 
            maxHeight: '300px', 
            overflowY: 'auto',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '10px'
          }}>
            {cards.map((card) => (
              <div 
                key={card.id} 
                style={{ 
                  marginBottom: '10px',
                  padding: '12px',
                  background: '#1a1a1a',
                  color: '#00ff00',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  border: '1px solid #333'
                }}
              >
                <div style={{ color: '#ffff00' }}><strong>ID:</strong> <span style={{ color: '#00ff00' }}>{card.id}</span></div>
                <div style={{ color: '#ffff00' }}><strong>Slug:</strong> <span style={{ color: '#00ff00' }}>{card.slug}</span></div>
                <div style={{ color: '#ffff00' }}><strong>Name:</strong> <span style={{ color: '#00ff00' }}>{card.name}</span></div>
                <div style={{ color: '#ffff00' }}><strong>Created:</strong> <span style={{ color: '#00ff00' }}>{new Date(card.createdAt).toLocaleString()}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}