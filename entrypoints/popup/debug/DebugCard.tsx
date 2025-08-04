import { useState } from 'react';
import type { Card } from '@/shared/cards';
import { useRateCardMutation } from '@/hooks/useBackgroundQueries';
import { Rating } from 'ts-fsrs';
import './DebugPanel.css';

interface DebugCardProps {
  card: Card;
  onRemove: (slug: string) => void;
}

export function DebugCard({ card, onRemove }: DebugCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const rateCardMutation = useRateCardMutation();

  const handleRate = async (rating: Rating) => {
    // Skip Rating.Manual as it's not a valid grade
    if (rating === Rating.Manual) return;

    try {
      await rateCardMutation.mutateAsync({
        slug: card.slug,
        name: card.name,
        rating: rating,
        leetcodeId: card.leetcodeId,
        difficulty: card.difficulty,
      });
    } catch (error) {
      console.error('Failed to rate card:', error);
    }
  };

  return (
    <div className="debug-panel-card">
      <div className="debug-panel-card-label">
        <strong>Slug:</strong> <span className="debug-panel-card-value">{card.slug}</span>
      </div>
      <div className="debug-panel-card-label">
        <strong>Name:</strong> <span className="debug-panel-card-value">{card.name}</span>
      </div>
      <div className="debug-panel-card-label">
        <strong>Difficulty:</strong> <span className="debug-panel-card-value">{card.difficulty}</span>
      </div>
      <div className="debug-panel-card-label">
        <strong>Created:</strong>{' '}
        <span className="debug-panel-card-value">{new Date(card.createdAt).toLocaleString()}</span>
      </div>

      {/* FSRS Data Section */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #444' }}>
        <div
          className="debug-panel-fsrs-header"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ cursor: 'pointer', color: '#ff9800', marginBottom: '4px' }}
        >
          <span className={`debug-panel-arrow ${isExpanded ? 'expanded' : ''}`}>▶</span>
          <strong style={{ marginLeft: '6px' }}>FSRS Data</strong>
        </div>
        {isExpanded && (
          <div style={{ marginLeft: '10px' }}>
            <div className="debug-panel-card-label" style={{ fontSize: '10px' }}>
              <strong>Due:</strong>{' '}
              <span className="debug-panel-card-value">{new Date(card.fsrs.due).toLocaleString()}</span>
            </div>
            <div className="debug-panel-card-label" style={{ fontSize: '10px' }}>
              <strong>Stability:</strong>{' '}
              <span className="debug-panel-card-value">{card.fsrs.stability.toFixed(2)}</span>
            </div>
            <div className="debug-panel-card-label" style={{ fontSize: '10px' }}>
              <strong>FSRS Difficulty:</strong>{' '}
              <span className="debug-panel-card-value">{card.fsrs.difficulty.toFixed(2)}</span>
            </div>
            <div className="debug-panel-card-label" style={{ fontSize: '10px' }}>
              <strong>Elapsed Days:</strong> <span className="debug-panel-card-value">{card.fsrs.elapsed_days}</span>
            </div>
            <div className="debug-panel-card-label" style={{ fontSize: '10px' }}>
              <strong>Scheduled Days:</strong>{' '}
              <span className="debug-panel-card-value">{card.fsrs.scheduled_days}</span>
            </div>
            <div className="debug-panel-card-label" style={{ fontSize: '10px' }}>
              <strong>Learning Steps:</strong>{' '}
              <span className="debug-panel-card-value">{card.fsrs.learning_steps}</span>
            </div>
            <div className="debug-panel-card-label" style={{ fontSize: '10px' }}>
              <strong>Reps:</strong> <span className="debug-panel-card-value">{card.fsrs.reps}</span>
            </div>
            <div className="debug-panel-card-label" style={{ fontSize: '10px' }}>
              <strong>Lapses:</strong> <span className="debug-panel-card-value">{card.fsrs.lapses}</span>
            </div>
            <div className="debug-panel-card-label" style={{ fontSize: '10px' }}>
              <strong>State:</strong> <span className="debug-panel-card-value">{card.fsrs.state}</span>
            </div>
            <div className="debug-panel-card-label" style={{ fontSize: '10px' }}>
              <strong>Last Review:</strong>{' '}
              <span className="debug-panel-card-value">
                {card.fsrs.last_review ? new Date(card.fsrs.last_review).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Rating Buttons */}
      <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
        <button
          onClick={() => handleRate(Rating.Again)}
          className="debug-panel-button"
          style={{ flex: 1, fontSize: '11px', padding: '4px', backgroundColor: '#d32f2f' }}
          disabled={rateCardMutation.isPending}
        >
          Again
        </button>
        <button
          onClick={() => handleRate(Rating.Hard)}
          className="debug-panel-button"
          style={{ flex: 1, fontSize: '11px', padding: '4px', backgroundColor: '#f57c00' }}
          disabled={rateCardMutation.isPending}
        >
          Hard
        </button>
        <button
          onClick={() => handleRate(Rating.Good)}
          className="debug-panel-button"
          style={{ flex: 1, fontSize: '11px', padding: '4px', backgroundColor: '#388e3c' }}
          disabled={rateCardMutation.isPending}
        >
          Good
        </button>
        <button
          onClick={() => handleRate(Rating.Easy)}
          className="debug-panel-button"
          style={{ flex: 1, fontSize: '11px', padding: '4px', backgroundColor: '#1976d2' }}
          disabled={rateCardMutation.isPending}
        >
          Easy
        </button>
      </div>

      <button
        onClick={() => onRemove(card.slug)}
        className="debug-panel-button"
        style={{ marginTop: '4px', width: '100%' }}
      >
        Remove
      </button>
    </div>
  );
}
