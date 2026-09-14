import { State } from 'ts-fsrs';
import { createMockCard } from './card-mocks';

// Legacy separate notes cover embedding and empty-note normalization in compatibility tests.
export function validLegacyBackup() {
  const timestamp = '2024-01-15T10:00:00.000Z';
  const time = new Date(timestamp).getTime();
  const card = createMockCard(State.Review, { id: 'valid-com', slug: 'two-sum', createdAt: time, paused: true });
  card.fsrs = { ...card.fsrs, due: time, last_review: time, scheduled_days: 7 };
  const cards = {
    'two-sum': card,
    'cn-problem': { ...card, id: 'valid-cn', slug: 'cn-problem', domain: 'leetcode.cn' as const, paused: false },
  };
  const legacyStats = {
    '2024-01-01': {
      date: '2024-01-01',
      totalReviews: 0,
      newCards: 0,
      reviewedCards: 0,
      streak: 1,
      gradeBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0 },
    },
  };
  const notes = { 'valid-com': { text: 'Keep this note' }, 'valid-cn': { text: '' } };
  const convertedCards = { ...cards, 'two-sum': { ...card, note: 'Keep this note' } };
  return {
    backup: {
      schemaVersion: 2,
      exportDate: timestamp,
      dataUpdatedAt: timestamp,
      data: { cards, stats: legacyStats, notes },
    },
    legacyConverted: { cards: convertedCards, stats: legacyStats },
    converted: { cards: convertedCards, reviewActivity: { date: '2024-01-01', newCards: 0, streak: 1 } },
  };
}
