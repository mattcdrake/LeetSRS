import { validateNoteText } from '@/domain/notes';
import { saveNote as writeNote } from '@/infrastructure/storage/notes';

export { deleteNote, getNote } from '@/infrastructure/storage/notes';

export async function saveNote(cardId: string, text: string): Promise<void> {
  validateNoteText(text);

  await writeNote(cardId, text);
}
