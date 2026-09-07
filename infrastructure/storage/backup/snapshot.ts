import { storage } from '#imports';
import type { Note } from '@/domain/notes';
import { deleteNote, getNote } from '../notes';
import { getNoteStorageKey, STORAGE_KEYS } from '../storage-keys';
import type { ExportData } from './codec';

type SnapshotCards = ExportData['data']['cards'];

// Snapshot workflows preserve raw records, including unknown and legacy fields.
export function readSnapshotCards(): Promise<SnapshotCards | null> {
  return storage.getItem<SnapshotCards>(STORAGE_KEYS.cards);
}

export function writeSnapshotCards(cards: SnapshotCards): Promise<void> {
  return storage.setItem(STORAGE_KEYS.cards, cards);
}

export function removeSnapshotCards(): Promise<void> {
  return storage.removeItem(STORAGE_KEYS.cards);
}

export async function readSnapshotNotes(cards: SnapshotCards): Promise<Record<string, Note>> {
  const notes: Record<string, Note> = {};
  for (const card of Object.values(cards)) {
    const note = await getNote(card.id);
    if (note) {
      notes[card.id] = note;
    }
  }
  return notes;
}

export async function writeSnapshotNotes(notes: Record<string, Note>): Promise<void> {
  for (const [cardId, note] of Object.entries(notes)) {
    await storage.setItem(getNoteStorageKey(cardId), note);
  }
}

export async function removeSnapshotNotes(cards: SnapshotCards): Promise<void> {
  for (const card of Object.values(cards)) {
    await deleteNote(card.id);
  }
}
