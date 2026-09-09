import { State } from 'ts-fsrs';
import { createDailyStats } from '@/domain/statistics';
import { createMockCard } from './card-mocks';

// Change one envelope field at a time in an otherwise valid backup. Sharing these
// JSON inputs lets domain tests check rejection and service tests verify that the
// same rejection happens before existing storage is changed.
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

// Valid records seed existing storage and exercise round trips. The mixed payload
// adds malformed records so import and Gist tests can verify that the whole request
// fails without replacing that storage. It is valid JSON: undefined fields become
// missing fields, so rejection exercises validation rather than JSON syntax.
export function mixedRecordBackup() {
  const timestamp = '2024-01-15T10:00:00.000Z';
  const date = new Date(timestamp);
  const card = createMockCard(State.Review, {
    id: 'valid-com',
    slug: 'two-sum',
    createdAt: date,
    paused: true,
  });
  const validCard = {
    ...card,
    createdAt: date.getTime(),
    fsrs: { ...card.fsrs, due: date.getTime(), last_review: date.getTime(), scheduled_days: 7 },
    unknownField: { retained: true },
  };
  const acceptedCards = {
    'two-sum': validCard,
    'cn-problem': { ...validCard, id: 'valid-cn', slug: 'cn-problem', domain: 'leetcode.cn', paused: false },
    'bad-note': { ...validCard, id: 'bad-note', slug: 'bad-note' },
    'missing-note-text': { ...validCard, id: 'missing-note-text', slug: 'missing-note-text' },
  };
  const cards: Record<string, unknown> = { ...acceptedCards };
  const notes: Record<string, unknown> = {
    'valid-com': { text: 'Keep this note', unknownField: 42 },
    'valid-cn': { text: '' },
    'bad-note': { text: 42 },
    'missing-note-text': {},
    orphan: { text: 'No owning card' },
  };
  const addInvalidCard = (key: string, overrides: Record<string, unknown>) => {
    cards[key] = { ...validCard, id: key, slug: key, ...overrides };
    notes[key] = { text: 'Reject along with its owner' };
  };
  for (const field of ['id', 'slug', 'name', 'leetcodeId', 'difficulty', 'createdAt', 'fsrs', 'domain', 'paused']) {
    addInvalidCard(`missing-${field}`, { [field]: undefined });
  }
  for (const field of ['id', 'slug', 'name', 'leetcodeId']) {
    addInvalidCard(`empty-${field}`, { [field]: '' });
    addInvalidCard(`numeric-${field}`, { [field]: 42 });
  }
  addInvalidCard('invalid-difficulty', { difficulty: 'Impossible' });
  addInvalidCard('invalid-domain', { domain: 'example.com' });
  addInvalidCard('invalid-paused', { paused: 'false' });
  addInvalidCard('invalid-createdAt', { createdAt: timestamp });
  addInvalidCard('invalid-due', { fsrs: { ...validCard.fsrs, due: timestamp } });
  addInvalidCard('invalid-last-review', { fsrs: { ...validCard.fsrs, last_review: null } });
  for (const field of [
    'stability',
    'difficulty',
    'elapsed_days',
    'scheduled_days',
    'reps',
    'lapses',
    'learning_steps',
  ]) {
    addInvalidCard(`invalid-fsrs-${field}`, { fsrs: { ...validCard.fsrs, [field]: '1' } });
    addInvalidCard(`missing-fsrs-${field}`, { fsrs: { ...validCard.fsrs, [field]: undefined } });
  }
  addInvalidCard('invalid-state', { fsrs: { ...validCard.fsrs, state: 99 } });
  addInvalidCard('mismatched-key', { slug: 'different-slug' });
  addInvalidCard('duplicate-a', { id: 'duplicate' });
  addInvalidCard('duplicate-b', { id: 'duplicate' });
  notes.duplicate = { text: 'Ambiguous owner' };
  cards['null-card'] = null;
  cards['array-card'] = [];

  const validStats = { ...createDailyStats('2024-01-01', undefined), unknownField: true };
  const acceptedStats = { '2024-01-01': validStats };
  const stats: Record<string, unknown> = {
    ...acceptedStats,
    '2024-02-30': { ...validStats, date: '2024-02-30' },
    'not-a-date': { ...validStats, date: 'not-a-date' },
    '2024-01-02': { ...validStats, date: '2024-01-03' },
    '2024-01-03': { ...validStats, date: 42 },
  };
  let day = 4;
  for (const field of ['totalReviews', 'newCards', 'reviewedCards', 'streak']) {
    for (const value of [-1, 0.5, '1', null]) {
      const key = `2024-01-${String(day++).padStart(2, '0')}`;
      stats[key] = { ...validStats, date: key, [field]: value };
    }
  }
  for (const value of [-1, 0.5, '1', undefined]) {
    const key = `2024-01-${String(day++).padStart(2, '0')}`;
    stats[key] = { ...validStats, date: key, gradeBreakdown: { ...validStats.gradeBreakdown, 1: value } };
  }
  const acceptedNotes = { 'valid-com': notes['valid-com'], 'valid-cn': notes['valid-cn'] };
  return {
    payload: { schemaVersion: 2, exportDate: timestamp, dataUpdatedAt: timestamp, data: { cards, stats, notes } },
    accepted: { cards: acceptedCards, stats: acceptedStats, notes: acceptedNotes },
  };
}
