import { State } from 'ts-fsrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { ZodError } from 'zod';
import { NOTES_MAX_LENGTH } from '@/domain/notes';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { createMockCard } from '@/test/utils/card-mocks';
import { getAllCards, saveCards } from '../cards';
import { deleteNote, getNote, saveNote } from '../notes';

describe('Note persistence', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
  });

  it.each(['a'.repeat(NOTES_MAX_LENGTH + 1), 42, {}, [], false, null].map((note) => ({ note })))(
    'rejects invalid stored note %j',
    async ({ note }) => {
      await storage.setItem(STORAGE_KEYS.cards, {
        invalid: { ...createMockCard(State.New, { id: 'invalid', slug: 'invalid' }), note },
      });
      await expect(getNote('invalid')).rejects.toBeInstanceOf(ZodError);
    }
  );

  it('strips unknown stored fields without trimming text', async () => {
    await storage.setItem(STORAGE_KEYS.cards, {
      extra: { ...createMockCard(State.New, { id: 'extra', slug: 'extra' }), note: '  note  ', extra: true },
    });
    expect(await getNote('extra')).toEqual({ text: '  note  ' });
  });

  it.each([false, true])('rejects overlong writes without changing storage (existing note: %s)', async (existing) => {
    await saveCards([createMockCard(State.New, { id: 'card' })]);
    const text = 'a'.repeat(NOTES_MAX_LENGTH);
    if (existing) await saveNote('card', text);
    await expect(saveNote('card', 'b'.repeat(NOTES_MAX_LENGTH + 1))).rejects.toThrow(
      `Note exceeds maximum length of ${NOTES_MAX_LENGTH} characters`
    );
    expect(await getNote('card')).toEqual(existing ? { text } : null);
  });

  it('does not create notes for missing cards', async () => {
    await expect(saveNote('missing', 'note')).rejects.toThrow('not found');
    await deleteNote('missing');
    expect(await getNote('missing')).toBeNull();
    expect(await getAllCards()).toEqual([]);
  });

  it('round-trips notes independently through creation, replacement, and deletion', async () => {
    const first = createMockCard(State.Review, { id: 'first-card', slug: 'first' });
    const second = createMockCard(State.New, { id: 'second-card', slug: 'second' });
    await saveCards([first, second]);
    expect(await getNote('first-card')).toBeNull();
    await saveNote('first-card', 'Original solution');
    await saveNote('second-card', 'Other solution');
    expect(await getNote('first-card')).toEqual({ text: 'Original solution' });
    expect(await getNote('second-card')).toEqual({ text: 'Other solution' });

    await saveNote('first-card', '');
    expect(await getNote('first-card')).toEqual({ text: '' });
    await saveNote('first-card', 'Revised solution');
    expect(await getNote('first-card')).toEqual({ text: 'Revised solution' });
    expect(await getNote('second-card')).toEqual({ text: 'Other solution' });

    await deleteNote('first-card');
    expect(await getNote('first-card')).toBeNull();
    expect(await getAllCards()).toEqual([first, { ...second, note: 'Other solution' }]);
    expect(await getNote('second-card')).toEqual({ text: 'Other solution' });

    await expect(deleteNote('first-card')).resolves.toBeUndefined();
    expect(await getNote('second-card')).toEqual({ text: 'Other solution' });
  });
});
