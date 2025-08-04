import { storage } from '#imports';
import { getNoteStorageKey } from './storage-keys';
import { validateNoteText, type Note } from '@/shared/notes';

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
