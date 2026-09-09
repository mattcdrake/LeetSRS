import { describe, expect, it } from 'vitest';
import { mixedRecordBackup } from '@/test/utils/backup-mocks';
import { exportDataSchema, validateBackupRecords } from '../backup';

describe('backup record validation', () => {
  it.each([
    { createdAt: 1e100 },
    { createdAt: null },
    { difficulty: ['Easy'] },
    { fsrs: { due: 1e100 } },
    { fsrs: { stability: -1 } },
    { fsrs: { difficulty: Number.POSITIVE_INFINITY } },
    { fsrs: { reps: 0.5 } },
    { fsrs: { state: 1.5 } },
  ])('rejects malformed card fields: %j', (overrides) => {
    const { accepted } = mixedRecordBackup();
    const card = accepted.cards['two-sum'];
    expect(() =>
      validateBackupRecords({
        cards: { invalid: { ...card, ...overrides, fsrs: { ...card.fsrs, ...overrides.fsrs } } },
        stats: {},
        notes: {},
      })
    ).toThrow();
  });

  it('removes extra nested fields without coercing supported values', () => {
    const { accepted } = mixedRecordBackup();
    const card = { ...accepted.cards['two-sum'], name: '  Two Sum  ' };
    const stats = accepted.stats['2024-01-01'];
    const records = {
      cards: { 'two-sum': { ...card, extra: true, fsrs: { ...card.fsrs, extra: { source: 'legacy' } } } },
      stats: { '2024-01-01': { ...stats, extra: true, gradeBreakdown: { ...stats.gradeBreakdown, extra: 42 } } },
      notes: { 'valid-com': { text: '  Keep this note  ', extra: true } },
      extra: true,
    };
    expect(validateBackupRecords(records)).toEqual({
      cards: { 'two-sum': card },
      stats: { '2024-01-01': stats },
      notes: { 'valid-com': { text: '  Keep this note  ' } },
    });
    const metadata = { schemaVersion: 2, exportDate: '2024-01-01T00:00:00.000Z' };
    expect(
      exportDataSchema.parse({
        ...metadata,
        extra: true,
        data: {
          ...records,
          settings: { theme: 'dark', extra: true },
          gistSync: { enabled: false, pat: 'secret', githubPat: 'legacy-secret', extra: true },
        },
      })
    ).toEqual({
      ...metadata,
      data: {
        cards: { 'two-sum': card },
        stats: { '2024-01-01': stats },
        notes: { 'valid-com': { text: '  Keep this note  ' } },
        settings: { theme: 'dark' },
        gistSync: { enabled: false },
      },
    });
  });

  it('accepts an unreviewed card with zero FSRS values and no last review', () => {
    const { accepted } = mixedRecordBackup();
    const card = {
      ...accepted.cards['two-sum'],
      fsrs: {
        due: 0,
        state: 0,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        learning_steps: 0,
      },
    };
    expect(validateBackupRecords({ cards: { 'two-sum': card }, stats: {}, notes: {} }).cards).toEqual({
      'two-sum': card,
    });
  });
});
