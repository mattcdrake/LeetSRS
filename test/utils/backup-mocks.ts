import { LearningState as State } from '@/domain/scheduling';
import { createMockCard } from './card-mocks';

// Change one envelope field at a time to verify rejection before storage is changed.
export function malformedBackupCases(payload: { data: object }): [string, string][] {
  return [
    ...(['cards', 'stats', 'notes'] as const).map((key): [string, string] => [
      `array-shaped ${key}`,
      JSON.stringify({ ...payload, data: { ...payload.data, [key]: [] } }),
    ]),
    ...[-1, 0.5, '0', null, true].map((schemaVersion): [string, string] => [
      `schema version ${JSON.stringify(schemaVersion)}`,
      JSON.stringify({ ...payload, schemaVersion }),
    ]),
    ...(['exportDate', 'dataUpdatedAt'] as const).flatMap((key) =>
      ['', 'not-a-date', '2024-13-01T00:00:00.000Z', 1704067200000, null, true, {}].map((value): [string, string] => [
        `${key} ${JSON.stringify(value)}`,
        JSON.stringify({ ...payload, [key]: value }),
      ])
    ),
    ...(['settings', 'gistSync'] as const).flatMap((key) =>
      [[], 'invalid', 42, false, null].map((value): [string, string] => [
        `${key} ${JSON.stringify(value)}`,
        JSON.stringify({ ...payload, data: { ...payload.data, [key]: value } }),
      ])
    ),
    ...[{ gistId: 42 }, { gistId: null }, { enabled: 'yes' }, { enabled: null }].map((gistSync): [string, string] => [
      `Gist configuration ${JSON.stringify(gistSync)}`,
      JSON.stringify({ ...payload, data: { ...payload.data, gistSync } }),
    ]),
    ...[{ theme: 'invalid' }, { badgeEnabled: 'yes' }, { autoClearLeetcode: 'yes' }].map(
      (settings): [string, string] => [
        `settings fields ${JSON.stringify(settings)}`,
        JSON.stringify({ ...payload, data: { ...payload.data, settings } }),
      ]
    ),
  ];
}

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
  const stats = {
    '2024-01-01': {
      newCards: 0,
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
    converted: { cards: convertedCards, stats },
  };
}
