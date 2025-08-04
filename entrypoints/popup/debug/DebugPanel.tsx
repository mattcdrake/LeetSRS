import { useState } from 'react';
import { useCardsQuery, useAddCardMutation, useRemoveCardMutation } from '@/hooks/useBackgroundQueries';
import { type Difficulty } from '@/shared/cards';
import { DebugCard } from './DebugCard';
import { ReviewQueue } from './ReviewQueue';
import { TodayStats } from './TodayStats';
import { storage } from '#imports';
import './DebugPanel.css';

// Sample LeetCode problems with their actual IDs
const SAMPLE_PROBLEMS = [
  { slug: 'two-sum', name: 'Two Sum', leetcodeId: '1', difficulty: 'Easy' as Difficulty },
  { slug: 'add-two-numbers', name: 'Add Two Numbers', leetcodeId: '2', difficulty: 'Medium' as Difficulty },
  {
    slug: 'longest-substring-without-repeating-characters',
    name: 'Longest Substring Without Repeating Characters',
    leetcodeId: '3',
    difficulty: 'Medium' as Difficulty,
  },
  {
    slug: 'median-of-two-sorted-arrays',
    name: 'Median of Two Sorted Arrays',
    leetcodeId: '4',
    difficulty: 'Hard' as Difficulty,
  },
  { slug: 'reverse-integer', name: 'Reverse Integer', leetcodeId: '7', difficulty: 'Easy' as Difficulty },
  {
    slug: 'container-with-most-water',
    name: 'Container With Most Water',
    leetcodeId: '11',
    difficulty: 'Medium' as Difficulty,
  },
  { slug: 'valid-parentheses', name: 'Valid Parentheses', leetcodeId: '20', difficulty: 'Easy' as Difficulty },
  {
    slug: 'merge-two-sorted-lists',
    name: 'Merge Two Sorted Lists',
    leetcodeId: '21',
    difficulty: 'Easy' as Difficulty,
  },
  { slug: 'trapping-rain-water', name: 'Trapping Rain Water', leetcodeId: '42', difficulty: 'Hard' as Difficulty },
  { slug: 'group-anagrams', name: 'Group Anagrams', leetcodeId: '49', difficulty: 'Medium' as Difficulty },
  { slug: 'maximum-subarray', name: 'Maximum Subarray', leetcodeId: '53', difficulty: 'Medium' as Difficulty },
  { slug: 'climbing-stairs', name: 'Climbing Stairs', leetcodeId: '70', difficulty: 'Easy' as Difficulty },
  {
    slug: 'best-time-to-buy-and-sell-stock',
    name: 'Best Time to Buy and Sell Stock',
    leetcodeId: '121',
    difficulty: 'Easy' as Difficulty,
  },
  { slug: 'house-robber', name: 'House Robber', leetcodeId: '198', difficulty: 'Medium' as Difficulty },
  { slug: 'reverse-linked-list', name: 'Reverse Linked List', leetcodeId: '206', difficulty: 'Easy' as Difficulty },
  {
    slug: 'binary-tree-inorder-traversal',
    name: 'Binary Tree Inorder Traversal',
    leetcodeId: '94',
    difficulty: 'Easy' as Difficulty,
  },
  {
    slug: 'kth-largest-element-in-an-array',
    name: 'Kth Largest Element in an Array',
    leetcodeId: '215',
    difficulty: 'Medium' as Difficulty,
  },
  {
    slug: 'product-of-array-except-self',
    name: 'Product of Array Except Self',
    leetcodeId: '238',
    difficulty: 'Medium' as Difficulty,
  },
  { slug: 'min-stack', name: 'Min Stack', leetcodeId: '155', difficulty: 'Medium' as Difficulty },
  { slug: 'number-of-islands', name: 'Number of Islands', leetcodeId: '200', difficulty: 'Medium' as Difficulty },
];

export function DebugPanel() {
  const [isCardsCollapsed, setIsCardsCollapsed] = useState(true);

  const { data: cards, isLoading: isLoadingCards, error: cardsError } = useCardsQuery();
  const addCardMutation = useAddCardMutation();
  const removeCardMutation = useRemoveCardMutation();

  const cardsList = cards ?? [];

  const handleAddRandomCard = async () => {
    // Filter out problems that already exist
    const existingsSlugs = new Set(cardsList.map((card) => card.slug));
    const availableProblems = SAMPLE_PROBLEMS.filter((p) => !existingsSlugs.has(p.slug));

    if (availableProblems.length === 0) {
      console.log('All sample problems already added');
      return;
    }

    // Pick a random problem
    const randomProblem = availableProblems[Math.floor(Math.random() * availableProblems.length)];

    try {
      await addCardMutation.mutateAsync({
        slug: randomProblem.slug,
        name: randomProblem.name,
        leetcodeId: randomProblem.leetcodeId,
        difficulty: randomProblem.difficulty,
      });
    } catch (error) {
      console.error('Failed to add random card:', error);
    }
  };

  const handleRemoveCard = async (slug: string) => {
    try {
      await removeCardMutation.mutateAsync(slug);
    } catch (error) {
      console.error('Failed to remove card:', error);
    }
  };

  const handleDeleteAllCards = async () => {
    if (!confirm('Are you sure you want to delete all cards? This cannot be undone.')) {
      return;
    }

    try {
      // Delete all cards one by one
      for (const card of cardsList) {
        await removeCardMutation.mutateAsync(card.slug);
      }
    } catch (error) {
      console.error('Failed to delete all cards:', error);
    }
  };

  const handleWipeStorage = async () => {
    if (
      !confirm(
        '⚠️ WARNING: This will delete ALL data including cards, stats, and settings. This cannot be undone.\n\nAre you absolutely sure?'
      )
    ) {
      return;
    }

    try {
      // Clear all storage areas
      await storage.clear('local');
      await storage.clear('sync');
      await storage.clear('session');

      // Force refresh the page to reset the UI
      window.location.reload();
    } catch (error) {
      console.error('Failed to wipe storage:', error);
      alert('Failed to wipe storage. Check console for details.');
    }
  };

  return (
    <div className="debug-panel">
      <h2 className="debug-panel-title">🔧 DEBUG PANEL</h2>

      <div className="debug-panel-input-container" style={{ marginBottom: '16px' }}>
        <button
          onClick={handleAddRandomCard}
          disabled={addCardMutation.isPending || cardsList.length >= SAMPLE_PROBLEMS.length}
          className="debug-panel-button"
          style={{
            width: '100%',
            backgroundColor: cardsList.length >= SAMPLE_PROBLEMS.length ? '#666' : '#4CAF50',
            padding: '8px',
            fontSize: '14px',
          }}
          title={
            cardsList.length >= SAMPLE_PROBLEMS.length ? 'All sample problems added' : 'Add a random LeetCode problem'
          }
        >
          {addCardMutation.isPending
            ? 'Adding...'
            : cardsList.length >= SAMPLE_PROBLEMS.length
              ? '✅ All Problems Added'
              : `🎲 Add Random Problem (${SAMPLE_PROBLEMS.length - cardsList.length} available)`}
        </button>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3
            className="debug-panel-cards-header"
            style={{ cursor: 'pointer', userSelect: 'none', margin: 0 }}
            onClick={() => setIsCardsCollapsed(!isCardsCollapsed)}
          >
            <span style={{ marginRight: '8px' }}>{isCardsCollapsed ? '▶' : '▼'}</span>
            Cards in Storage ({cardsList.length})
          </h3>
          {cardsList.length > 0 && (
            <button
              onClick={handleDeleteAllCards}
              disabled={removeCardMutation.isPending}
              className="debug-panel-button"
              style={{
                backgroundColor: '#d32f2f',
                padding: '4px 12px',
                fontSize: '12px',
              }}
              title="Delete all cards"
            >
              {removeCardMutation.isPending ? 'Deleting...' : '🗑️ Delete All'}
            </button>
          )}
        </div>
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

      <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #ff0000' }}>
        <h3 style={{ color: '#ff6b6b', marginBottom: '10px', fontSize: '14px' }}>⚠️ DANGER ZONE</h3>
        <button
          onClick={handleWipeStorage}
          className="debug-panel-button"
          style={{
            width: '100%',
            backgroundColor: '#8b0000',
            color: '#fff',
            padding: '12px',
            fontSize: '14px',
            fontWeight: 'bold',
            border: '2px solid #ff0000',
          }}
          title="Completely wipe all extension storage"
        >
          ☠️ WIPE ALL STORAGE ☠️
        </button>
        <p style={{ fontSize: '11px', color: '#888', marginTop: '8px', textAlign: 'center' }}>
          This will delete ALL data: cards, stats, settings, everything!
        </p>
      </div>
    </div>
  );
}
