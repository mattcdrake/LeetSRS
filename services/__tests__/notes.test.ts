import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { NOTES_MAX_LENGTH } from '@/domain/notes';
import { getNote, saveNote } from '../notes';

describe('Notes Service', () => {
  beforeEach(() => fakeBrowser.reset());

  it('should save a note at maximum length', async () => {
    const cardId = 'test-card-max';
    const maxLengthText = 'a'.repeat(NOTES_MAX_LENGTH);

    await saveNote(cardId, maxLengthText);

    const note = await getNote(cardId);
    expect(note?.text).toBe(maxLengthText);
    expect(note?.text.length).toBe(NOTES_MAX_LENGTH);
  });

  it('should throw an error when text exceeds maximum length', async () => {
    const cardId = 'test-card-too-long';
    const tooLongText = 'a'.repeat(NOTES_MAX_LENGTH + 1);

    await expect(saveNote(cardId, tooLongText)).rejects.toThrow(
      `Note exceeds maximum length of ${NOTES_MAX_LENGTH} characters`
    );

    // Verify nothing was saved
    const note = await getNote(cardId);
    expect(note).toBeNull();
  });
});
