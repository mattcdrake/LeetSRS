import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { createDailyStats } from '@/domain/statistics';
import { createMockCard } from '@/test/utils/card-mocks';
import { embedNotes, validateOutput } from '../004-embed-notes';
import { readDataset } from '../layouts/v4';
import { LATEST_SCHEMA_VERSION, migrateBackupData, runStartupMigrations, setSchemaVersion } from '../runner';

describe('embedded note migration', () => {
  beforeEach(() => fakeBrowser.reset());

  it('moves attached text onto its card without mutating the historical dataset', () => {
    const base = createMockCard(State.Review, { id: 'owner', slug: 'two-sum', paused: true });
    const card = Object.freeze({
      ...base,
      extra: { retained: true },
      fsrs: Object.freeze({ ...base.fsrs, extra: { retained: true } }),
    });
    const input = Object.freeze({
      cards: Object.freeze({ 'two-sum': card }),
      notes: Object.freeze({ owner: Object.freeze({ text: '  Keep the complement  ' }) }),
      stats: { '2024-01-01': { ...createDailyStats('2024-01-01', undefined), historical: true } },
      settings: { theme: 'dark' },
    });
    const before = JSON.stringify(input);

    const output = migrateBackupData(input, 3);

    expect(output).toEqual({
      cards: { 'two-sum': { ...card, note: '  Keep the complement  ' } },
      stats: input.stats,
      settings: input.settings,
    });
    expect(migrateBackupData(input, 3)).toEqual(output);
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([
    { embedded: {}, legacy: undefined, expected: undefined },
    { embedded: {}, legacy: { text: '' }, expected: undefined },
    { embedded: {}, legacy: { text: ' \t\n ' }, expected: ' \t\n ' },
    { embedded: {}, legacy: { text: 'x'.repeat(500) }, expected: 'x'.repeat(500) },
    { embedded: { note: 'Embedded' }, legacy: { text: 'Legacy' }, expected: 'Embedded' },
    { embedded: { note: '' }, legacy: { text: 'Legacy' }, expected: undefined },
    { embedded: { note: 'Embedded' }, legacy: undefined, expected: 'Embedded' },
  ])('preserves note precedence and absence: %j', ({ embedded, legacy, expected }) => {
    const card = createMockCard(State.Relearning, { id: 'owner', slug: 'two-sum' });
    const output = embedNotes.migrate({
      cards: { 'two-sum': { ...card, ...embedded } },
      notes: { ...(legacy !== undefined && { owner: legacy }), orphan: { text: 42 } },
    });
    expect(output).toEqual({ cards: { 'two-sum': { ...card, ...(expected ? { note: expected } : {}) } } });
  });

  it('preserves legal object keys for both card slugs and legacy note owners', () => {
    const card = createMockCard(State.New, { id: '__proto__', slug: '__proto__' });
    expect(embedNotes.migrate({ cards: { ['__proto__']: card }, notes: { ['__proto__']: { text: 'Keep' } } })).toEqual({
      cards: { ['__proto__']: { ...card, note: 'Keep' } },
    });
  });

  it.each([
    { cards: { invalid: null } },
    { cards: { ['__proto__']: null } },
    { notes: [] },
    { notes: null },
    { notes: { owner: {} } },
    { notes: { owner: null } },
    { notes: { owner: { text: 42 } } },
    { notes: { owner: { text: 'x'.repeat(501) } } },
    ...[42, null, 'x'.repeat(501)].map((note) => ({ note })),
    { id: '' },
    { slug: 'different' },
    { fsrs: { due: 0 } },
    { duplicate: true },
  ])(
    'rejects malformed attached data and ambiguous identities before startup writes: %j',
    async (invalid: Record<string, unknown>) => {
      const { cards, notes = {}, duplicate, ...fields } = invalid;
      const card = createMockCard(State.Review, { id: 'owner', slug: 'two-sum' });
      const input = {
        cards: cards ?? {
          'two-sum': { ...card, ...fields },
          ...(duplicate === true && { other: { ...card, slug: 'other' } }),
        },
        notes,
      };
      expect(() => embedNotes.migrate(input)).toThrow();
      await setSchemaVersion(3);
      await storage.setItem('local:leetsrs:cards', input.cards);
      // Preserve malformed containers and null values at the raw layout boundary.
      const local = await fakeBrowser.storage.local.get(null);
      if (notes !== null && typeof notes === 'object' && !Array.isArray(notes)) {
        for (const [id, note] of Object.entries(notes)) local[`leetsrs:notes:${id}`] = note;
      } else {
        // Separate browser keys always assemble a record; malformed containers occur in imports only.
        return;
      }
      vi.spyOn(storage, 'snapshot').mockImplementation(async (area) => (area === 'local' ? local : {}));
      const write = vi.spyOn(fakeBrowser.storage.local, 'set');
      const remove = vi.spyOn(fakeBrowser.storage.local, 'remove');
      await expect(runStartupMigrations()).rejects.toThrow('Failed to run migration 4');
      expect(write).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
      expect(await storage.getItem('local:leetsrs:schemaVersion')).toBe(3);
    }
  );

  it.each(['save', 'cleanup', 'version'] as const)('retries a populated upgrade after %s failure', async (stage) => {
    const card = createMockCard(State.Review, { id: 'owner', slug: 'two-sum', paused: true });
    await setSchemaVersion(3);
    await storage.setItems([
      { key: 'local:leetsrs:cards', value: { 'two-sum': card } },
      { key: 'local:leetsrs:notes:owner', value: { text: 'Keep the schedule' } },
      { key: 'local:leetsrs:notes:orphan', value: { invalid: true } },
      { key: 'local:unrelated', value: 'keep' },
    ]);
    const write = storage.setItem.bind(storage);
    const failure = new Error('Unavailable');
    const failed =
      stage === 'save'
        ? vi.spyOn(storage, 'setItem').mockRejectedValueOnce(failure)
        : stage === 'cleanup'
          ? vi.spyOn(storage, 'removeItems').mockRejectedValueOnce(failure)
          : vi
              .spyOn(storage, 'setItem')
              .mockImplementation((key, value) =>
                key === 'local:leetsrs:schemaVersion' ? Promise.reject(failure) : write(key, value)
              );
    await expect(runStartupMigrations()).rejects.toThrow('Failed to run migration 4');
    expect(await storage.getItem('local:leetsrs:schemaVersion')).toBe(3);
    expect(await storage.getItem('local:leetsrs:notes:owner')).toEqual(
      stage === 'version' ? null : { text: 'Keep the schedule' }
    );
    expect(await storage.getItem('local:leetsrs:cards')).toEqual({
      'two-sum': { ...card, ...(stage !== 'save' && { note: 'Keep the schedule' }) },
    });
    failed.mockRestore();
    await runStartupMigrations();
    await runStartupMigrations();
    expect(await fakeBrowser.storage.local.get(null)).toEqual({
      'leetsrs:cards': { 'two-sum': { ...card, note: 'Keep the schedule' } },
      'leetsrs:schemaVersion': LATEST_SCHEMA_VERSION,
      unrelated: 'keep',
    });
    const dataset = await readDataset();
    expect(dataset.cards).toEqual({ 'two-sum': { ...card, note: 'Keep the schedule' } });
    expect(() => validateOutput(dataset)).not.toThrow();
    expect(dataset).not.toHaveProperty('notes');
  });
});
