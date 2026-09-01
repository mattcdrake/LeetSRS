import { storage } from '#imports';
import { type Note, validateNoteText } from '@/shared/notes';
import { getNoteStorageKey } from './storage-keys';

export async function getNote(cardId: string): Promise<Note | null> {
  const key = getNoteStorageKey(cardId);
  const note = await storage.getItem<Note>(key);
  return note ?? null;
}

export async function saveNote(cardId: string, text: string): Promise<void> {
  validateNoteText(text);

  const key = getNoteStorageKey(cardId);
  const note: Note = {
    text,
  };
  await storage.setItem(key, note);
}

export async function deleteNote(cardId: string): Promise<void> {
  const key = getNoteStorageKey(cardId);
  await storage.removeItem(key);
}
