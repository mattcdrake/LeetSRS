import { useState } from 'react';
import type { Card } from '@/services/cards';
import './DebugPanel.css';

interface DebugCardProps {
  card: Card;
  onRemove: (slug: string) => void;
}

export function DebugCard({ card, onRemove }: DebugCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="debug-panel-card">
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
              <strong>Difficulty:</strong>{' '}
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

      <button
        onClick={() => onRemove(card.slug)}
        className="debug-panel-button"
        style={{ marginTop: '8px', width: '100%' }}
      >
        Remove
      </button>
    </div>
  );
}
