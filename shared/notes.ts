export const NOTES_MAX_LENGTH = 500;

export interface Note {
  text: string;
}

export function validateNoteText(text: string): void {
  if (text.length > NOTES_MAX_LENGTH) {
    throw new Error(`Note exceeds maximum length of ${NOTES_MAX_LENGTH} characters`);
  }
}
