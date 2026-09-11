import { type Note, noteSchema } from '@/domain/notes';
import { getAllCards, saveCards } from '@/infrastructure/storage/cards';

export async function getNote(slug: string): Promise<Note | null> {
  const cards = await getAllCards();
  const text = cards.find((card) => card.slug === slug)?.note;
  return text === undefined ? null : { text };
}

export async function saveNote(slug: string, text: string): Promise<void> {
  const note = noteSchema.parse({ text });
  const cards = await getAllCards();
  const card = cards.find((card) => card.slug === slug);
  if (!card) throw new Error(`Card with slug "${slug}" not found`);

  if (note.text === '') delete card.note;
  else card.note = note.text;
  await saveCards(cards);
}

export async function deleteNote(slug: string): Promise<void> {
  const cards = await getAllCards();
  const card = cards.find((card) => card.slug === slug);
  if (!card || card.note === undefined) return;

  delete card.note;
  await saveCards(cards);
}
