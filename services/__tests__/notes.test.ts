import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from 'wxt/utils/storage';
import { getNote, saveNote, deleteNote } from '../notes';
import { getNoteStorageKey } from '../storage-keys';
import { NOTES_MAX_LENGTH, type Note } from '@/shared/notes';

describe('Notes Service', () => {
  beforeEach(() => {
    // Reset the fake browser state before each test
    fakeBrowser.reset();
  });

  describe('getNote', () => {
    it('should return null when note does not exist', async () => {
      const note = await getNote('non-existent-card');
      expect(note).toBeNull();
    });

    it('should return the note when it exists', async () => {
      const cardId = 'test-card-1';
      const key = getNoteStorageKey(cardId);
      const testNote: Note = {
        text: 'This is a test note',
      };

      // Manually store a note
      await storage.setItem(key, testNote);

      // Retrieve the note
      const retrievedNote = await getNote(cardId);
      expect(retrievedNote).toEqual(testNote);
      expect(retrievedNote?.text).toBe('This is a test note');
    });

    it('should handle multiple different notes correctly', async () => {
      const cardId1 = 'card-1';
      const cardId2 = 'card-2';
      const note1: Note = { text: 'Note for card 1' };
      const note2: Note = { text: 'Note for card 2' };

      await storage.setItem(getNoteStorageKey(cardId1), note1);
      await storage.setItem(getNoteStorageKey(cardId2), note2);

      const retrieved1 = await getNote(cardId1);
      const retrieved2 = await getNote(cardId2);

      expect(retrieved1?.text).toBe('Note for card 1');
      expect(retrieved2?.text).toBe('Note for card 2');
    });
  });

  describe('saveNote', () => {
    it('should save a new note', async () => {
      const cardId = 'test-card-2';
      const noteText = 'This is my solution approach';

      await saveNote(cardId, noteText);

      // Verify the note was stored
      const key = getNoteStorageKey(cardId);
      const storedNote = await storage.getItem<Note>(key);

      expect(storedNote).toBeDefined();
      expect(storedNote?.text).toBe(noteText);
    });

    it('should overwrite an existing note', async () => {
      const cardId = 'test-card-3';
      const originalText = 'Original note';
      const updatedText = 'Updated note with new solution';

      // Save original note
      await saveNote(cardId, originalText);

      // Verify original was saved
      let note = await getNote(cardId);
      expect(note?.text).toBe(originalText);

      // Update the note
      await saveNote(cardId, updatedText);

      // Verify it was overwritten
      note = await getNote(cardId);
      expect(note?.text).toBe(updatedText);
    });

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

    it('should store notes with unique keys per card', async () => {
      const cardId1 = 'unique-1';
      const cardId2 = 'unique-2';

      await saveNote(cardId1, 'Note 1');
      await saveNote(cardId2, 'Note 2');

      // Verify both notes exist independently
      const key1 = getNoteStorageKey(cardId1);
      const key2 = getNoteStorageKey(cardId2);

      const stored1 = await storage.getItem<Note>(key1);
      const stored2 = await storage.getItem<Note>(key2);

      expect(stored1?.text).toBe('Note 1');
      expect(stored2?.text).toBe('Note 2');
      expect(key1).not.toBe(key2);
    });
  });

  describe('deleteNote', () => {
    it('should delete an existing note', async () => {
      const cardId = 'test-card-delete';
      const noteText = 'Note to be deleted';

      // First save a note
      await saveNote(cardId, noteText);

      // Verify it exists
      let note = await getNote(cardId);
      expect(note?.text).toBe(noteText);

      // Delete the note
      await deleteNote(cardId);

      // Verify it's gone
      note = await getNote(cardId);
      expect(note).toBeNull();

      // Also verify directly in storage
      const key = getNoteStorageKey(cardId);
      const storedNote = await storage.getItem<Note>(key);
      expect(storedNote).toBeNull();
    });

    it('should handle deleting non-existent note gracefully', async () => {
      const cardId = 'non-existent';

      // Should not throw
      await expect(deleteNote(cardId)).resolves.toBeUndefined();

      // Verify nothing exists
      const note = await getNote(cardId);
      expect(note).toBeNull();
    });

    it('should only delete the specified note when multiple exist', async () => {
      const cardId1 = 'card-to-delete';
      const cardId2 = 'card-to-keep';

      await saveNote(cardId1, 'Delete me');
      await saveNote(cardId2, 'Keep me');

      // Delete only the first note
      await deleteNote(cardId1);

      // Verify first is deleted
      const deleted = await getNote(cardId1);
      expect(deleted).toBeNull();

      // Verify second still exists
      const kept = await getNote(cardId2);
      expect(kept?.text).toBe('Keep me');
    });
  });
});
