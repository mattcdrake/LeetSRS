import { type Note, noteSchema } from '@/domain/notes';
import { getAllCards, saveCards } from './cards';

export async function getNote(cardId: string): Promise<Note | null> {
  const card = (await getAllCards()).find((card) => card.id === cardId);
  return card?.note === undefined ? null : { text: card.note };
}

export async function saveNote(cardId: string, text: string): Promise<void> {
  const note = noteSchema.parse({ text });
  const cards = await getAllCards();
  const card = cards.find((card) => card.id === cardId);
  if (!card) throw new Error(`Card with ID "${cardId}" not found`);
  card.note = note.text;
  await saveCards(cards);
}

export async function deleteNote(cardId: string): Promise<void> {
  const cards = await getAllCards();
  const card = cards.find((card) => card.id === cardId);
  if (!card || card.note === undefined) return;
  delete card.note;
  await saveCards(cards);
}
