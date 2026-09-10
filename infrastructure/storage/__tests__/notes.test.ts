import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { ZodError } from 'zod';
import { NOTES_MAX_LENGTH } from '@/domain/notes';
import { getNoteStorageKey } from '@/infrastructure/storage/storage-keys';
import { deleteNote, getNote, saveNote } from '../notes';

describe('Note persistence', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
  });

  it.each([{ text: 'a'.repeat(NOTES_MAX_LENGTH + 1) }, { text: 42 }, {}, [], false])(
    'rejects invalid stored note %j',
    async (note) => {
      await storage.setItem(getNoteStorageKey('invalid'), note);
      await expect(getNote('invalid')).rejects.toBeInstanceOf(ZodError);
    }
  );

  it('strips unknown stored fields without trimming text', async () => {
    await storage.setItem(getNoteStorageKey('extra'), { text: '  note  ', extra: true });
    expect(await getNote('extra')).toEqual({ text: '  note  ' });
  });

  it.each([false, true])('rejects overlong writes without changing storage (existing note: %s)', async (existing) => {
    const text = 'a'.repeat(NOTES_MAX_LENGTH);
    if (existing) await saveNote('card', text);
    await expect(saveNote('card', 'b'.repeat(NOTES_MAX_LENGTH + 1))).rejects.toThrow(
      `Note exceeds maximum length of ${NOTES_MAX_LENGTH} characters`
    );
    expect(await getNote('card')).toEqual(existing ? { text } : null);
  });

  it('round-trips notes independently through creation, replacement, and deletion', async () => {
    expect(await getNote('first-card')).toBeNull();
    await saveNote('first-card', 'Original solution');
    await saveNote('second-card', 'Other solution');
    expect(await getNote('first-card')).toEqual({ text: 'Original solution' });
    expect(await getNote('second-card')).toEqual({ text: 'Other solution' });

    await saveNote('first-card', 'Revised solution');
    expect(await getNote('first-card')).toEqual({ text: 'Revised solution' });
    expect(await getNote('second-card')).toEqual({ text: 'Other solution' });

    await deleteNote('first-card');
    expect(await getNote('first-card')).toBeNull();
    expect(await storage.getItem(getNoteStorageKey('first-card'))).toBeNull();
    expect(await getNote('second-card')).toEqual({ text: 'Other solution' });

    await expect(deleteNote('first-card')).resolves.toBeUndefined();
    expect(await getNote('second-card')).toEqual({ text: 'Other solution' });
  });
});
