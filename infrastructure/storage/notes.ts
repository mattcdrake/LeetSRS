import { storage } from '#imports';
import type { Card } from '@/domain/cards';
import type { Note } from '@/domain/notes';
import { getNoteStorageKey } from './storage-keys';

export async function getNote(cardId: string): Promise<Note | null> {
  const key = getNoteStorageKey(cardId);
  const note = await storage.getItem<Note>(key);
  return note ?? null;
}

export async function saveNote(cardId: string, text: string): Promise<void> {
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

export async function getNotesForCards(cards: Pick<Card, 'id'>[]): Promise<Record<string, Note>> {
  const notes: Record<string, Note> = {};
  for (const card of cards) {
    const note = await getNote(card.id);
    if (note) notes[card.id] = note;
  }
  return notes;
}
