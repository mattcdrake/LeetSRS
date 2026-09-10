import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { z } from 'zod';
import { getCurrentSchemaVersion, type Migration, migrateBackupData, runStartupMigrations } from '../migrations';

const snapshotKey = 'local:leetsrs:migrationSnapshot';
const sourceSchema = z.looseObject({
  cards: z.array(z.object({ id: z.string(), title: z.string() })),
  notes: z.record(z.string(), z.object({ text: z.string() })),
  generation: z.number(),
});
const destinationSchema = z.looseObject({
  entries: z.array(z.object({ id: z.string(), title: z.string(), note: z.string() })),
  generation: z.number(),
});
const original = {
  cards: [{ id: 'one', title: 'Two Sum' }],
  notes: { one: { text: 'Use a map' } },
  generation: 7,
  settings: { theme: 'dark' },
};
const expected = {
  entries: [{ id: 'one', title: 'Two Sum', note: 'Use a map' }],
  generation: 8,
  settings: { theme: 'dark' },
};

// A synthetic cross-area move with a shape change; the transformation cannot accept its own output.
const move: Migration = {
  description: 'Move cards and embed notes',
  load: async () => ({
    ...z.record(z.string(), z.unknown()).parse(await storage.getItem('local:test:remaining')),
    cards: await storage.getItem('local:test:cards'),
    notes: await storage.getItem('local:test:notes'),
  }),
  migrate: (input) => {
    const { cards, notes, generation, ...rest } = sourceSchema.parse(input);
    return destinationSchema.parse({
      ...rest,
      generation: generation + 1,
      entries: cards.map((card) => ({ ...card, note: notes[card.id]?.text ?? '' })),
    });
  },
  save: async (output) => {
    const { entries, ...rest } = destinationSchema.parse(output);
    await storage.setItem('local:test:remaining', rest);
    await storage.setItem('sync:test:entries', entries);
  },
  cleanup: async (input) => {
    // Cleanup can use original identifiers even after some sources have been removed.
    sourceSchema.parse(input);
    await storage.removeItems(['local:test:cards', 'local:test:notes']);
  },
};

async function readDestination() {
  return {
    ...z.record(z.string(), z.unknown()).parse(await storage.getItem('local:test:remaining')),
    entries: await storage.getItem('sync:test:entries'),
  };
}

beforeEach(async () => {
  fakeBrowser.reset();
  const { cards, notes, ...rest } = original;
  await storage.setItems([
    { key: 'local:test:cards', value: cards },
    { key: 'local:test:notes', value: notes },
    { key: 'local:test:remaining', value: rest },
  ]);
});

describe('startup snapshot recovery', () => {
  it('validates snapshots without rewriting historical JSON keys', async () => {
    const input: unknown = JSON.parse('{"records":{"__proto__":{"text":"preserve"}}}');
    const copy: Migration = {
      description: 'Preserve historical JSON',
      load: async () => input,
      migrate: (data) => data,
      save: (data) => storage.setItem('sync:test:copy', data),
    };
    const write = storage.setItem.bind(storage);
    const failure = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
      if (key === 'local:leetsrs:schemaVersion') throw new Error('version unavailable');
      return write(key, value);
    });

    await expect(runStartupMigrations([copy])).rejects.toThrow('version unavailable');
    expect(await storage.getItem(snapshotKey)).toEqual({ version: 1, input });
    failure.mockRestore();
    await runStartupMigrations([copy]);

    expect(await storage.getItem('sync:test:copy')).toEqual(input);
  });

  it.each(['snapshot', 'destination', 'cleanup', 'version', 'retirement'] as const)(
    'recovers an interrupted %s phase from its original input',
    async (phase) => {
      const before = await storage.snapshot('local');
      const write = storage.setItem.bind(storage);
      vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
        if (
          (phase === 'snapshot' && key === snapshotKey) ||
          (phase === 'destination' && key === 'sync:test:entries') ||
          (phase === 'version' && key === 'local:leetsrs:schemaVersion')
        ) {
          throw new Error(`${phase} unavailable`);
        }
        return write(key, value);
      });
      if (phase === 'cleanup') {
        vi.spyOn(storage, 'removeItems').mockImplementationOnce(async () => {
          await storage.removeItem('local:test:cards');
          throw new Error('cleanup unavailable');
        });
      }
      if (phase === 'retirement') {
        vi.spyOn(storage, 'removeItem').mockRejectedValueOnce(new Error('retirement unavailable'));
      }

      await expect(runStartupMigrations([move])).rejects.toThrow(`${phase} unavailable`);
      expect(await getCurrentSchemaVersion()).toBe(phase === 'retirement' ? 1 : 0);
      if (phase === 'snapshot') {
        expect(await storage.snapshot('local')).toEqual(before);
        expect(await storage.snapshot('sync')).toEqual({});
      } else {
        expect(await storage.getItem(snapshotKey)).toEqual({ version: 1, input: original });
        expect(await storage.getItem('local:test:remaining')).toEqual({ generation: 8, settings: { theme: 'dark' } });
      }
      if (phase === 'cleanup') {
        expect(await storage.getItem('local:test:cards')).toBeNull();
        expect(await storage.getItem('local:test:notes')).toEqual(original.notes);
      }
      vi.restoreAllMocks();
      const mustNotRun = () => {
        throw new Error('Completed work was replayed');
      };
      const resume: Migration =
        phase === 'snapshot'
          ? move
          : {
              ...move,
              load: mustNotRun,
              ...(phase === 'retirement' ? { migrate: mustNotRun, save: mustNotRun, cleanup: mustNotRun } : {}),
            };

      await runStartupMigrations([resume]);

      expect(await readDestination()).toEqual(expected);
      expect(await readDestination()).toEqual(migrateBackupData(original, 0, [move]));
      expect(await storage.getItem('local:test:cards')).toBeNull();
      expect(await storage.getItem('local:test:notes')).toBeNull();
      expect(await getCurrentSchemaVersion()).toBe(1);
      expect(await storage.getItem(snapshotKey)).toBeNull();
    }
  );

  it('finishes and retires each step before loading the next logical shape', async () => {
    const titles: Migration = {
      description: 'Reduce the dataset to a title list',
      load: async () => {
        expect(await getCurrentSchemaVersion()).toBe(1);
        expect(await storage.getItem(snapshotKey)).toBeNull();
        expect(await storage.getItem('local:test:notes')).toBeNull();
        return readDestination();
      },
      migrate: (data) => destinationSchema.parse(data).entries.map((entry) => entry.title),
      save: async (data) => {
        const parsed = z.array(z.string()).parse(data);
        expect(await getCurrentSchemaVersion()).toBe(1);
        expect(await storage.getItem(snapshotKey)).toEqual({ version: 2, input: expected });
        await storage.setItem('sync:test:titles', parsed);
      },
    };
    const steps = [move, titles];
    const frozen = Object.freeze({
      ...original,
      cards: Object.freeze(original.cards.map((card) => Object.freeze({ ...card }))),
      notes: Object.freeze({ one: Object.freeze({ text: 'Use a map' }) }),
      settings: Object.freeze({ theme: 'dark' }),
    });
    const before = await storage.snapshot('local');
    expect(migrateBackupData(frozen, 0, steps)).toEqual(['Two Sum']);
    expect(migrateBackupData(frozen, 0, steps)).toEqual(['Two Sum']);
    expect(await storage.snapshot('local')).toEqual(before);
    expect(await storage.snapshot('sync')).toEqual({});

    await runStartupMigrations(steps);
    await runStartupMigrations(steps);

    expect(await storage.getItem('sync:test:titles')).toEqual(['Two Sum']);
    expect(await getCurrentSchemaVersion()).toBe(2);
    expect(await storage.getItem(snapshotKey)).toBeNull();
    expect(migrateBackupData(expected, 1, steps)).toEqual(['Two Sum']);
    expect(migrateBackupData(['Two Sum'], 2, steps)).toEqual(['Two Sum']);
  });

  it('retains rejected historical input without touching destinations or later steps', async () => {
    await storage.setItem('local:test:cards', 'malformed');
    const before = await storage.snapshot('local');
    const next: Migration = {
      ...move,
      load: async () => {
        throw new Error('Next step must not start');
      },
    };

    await expect(runStartupMigrations([move, next])).rejects.toThrow('transform and validate');
    expect(await storage.snapshot('local')).toEqual({
      ...before,
      'leetsrs:migrationSnapshot': { version: 1, input: { ...original, cards: 'malformed' } },
    });
    expect(await storage.snapshot('sync')).toEqual({});
    await expect(runStartupMigrations([move, next])).rejects.toThrow('transform and validate');
  });

  it.each([
    { version: -1, snapshot: undefined },
    { version: 0.5, snapshot: undefined },
    { version: '0', snapshot: undefined },
    { version: 4, snapshot: { version: 1, input: original } },
    { version: 0, snapshot: { version: 2, input: original } },
    { version: 0, snapshot: { version: 4, input: original } },
    { version: 0, snapshot: { version: 0, input: original } },
    { version: 0, snapshot: { version: 0.5, input: original } },
    { version: 0, snapshot: { version: 1 } },
    { version: 0, snapshot: [] },
    { version: 0, snapshot: 'corrupt' },
    { version: 2, snapshot: { version: 1, input: original } },
  ])('blocks inconsistent metadata without changing recovery data: %j', async ({ version, snapshot }) => {
    await storage.setItem('local:leetsrs:schemaVersion', version);
    if (snapshot !== undefined) await storage.setItem(snapshotKey, snapshot);
    const before = await storage.snapshot('local');

    await expect(runStartupMigrations([move, move, move])).rejects.toThrow(/schema version|recovery metadata/);

    expect(await storage.snapshot('local')).toEqual(before);
    expect(await storage.snapshot('sync')).toEqual({});
  });

  it('supports an empty version sequence', async () => {
    const before = await storage.snapshot('local');
    await runStartupMigrations([]);
    expect(await storage.snapshot('local')).toEqual(before);
    expect(migrateBackupData(['unchanged'], 0, [])).toEqual(['unchanged']);
  });

  it('reports retirement failures after completion and leaves the snapshot available', async () => {
    await storage.setItem('local:leetsrs:schemaVersion', 1);
    await storage.setItem(snapshotKey, { version: 1, input: original });
    vi.spyOn(storage, 'removeItem').mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(runStartupMigrations([move])).rejects.toThrow('retire recovery snapshot');

    expect(await storage.getItem(snapshotKey)).toEqual({ version: 1, input: original });
    expect(await getCurrentSchemaVersion()).toBe(1);
  });

  it.each([
    undefined,
    { requiredInput: undefined },
    { requiredInput: Number.NaN },
    Object.fromEntries([['__proto__', { requiredInput: undefined }]]),
    Object.fromEntries([['__proto__', { requiredInput: Number.NaN }]]),
    new Date(0),
    Array(1),
    Object.assign([], { requiredInput: true }),
    Object.defineProperty({}, 'requiredInput', { value: true }),
    Object.defineProperty({}, 'requiredInput', { enumerable: true, get: () => true }),
  ])('rejects input that cannot be saved losslessly as JSON: %j', async (input) => {
    const before = await storage.snapshot('local');
    const migration: Migration = {
      ...move,
      load: async () => input,
      migrate: () => expected,
    };

    await expect(runStartupMigrations([migration])).rejects.toThrow('save recovery snapshot');

    expect(await storage.snapshot('local')).toEqual(before);
    expect(await storage.snapshot('sync')).toEqual({});
  });
});
