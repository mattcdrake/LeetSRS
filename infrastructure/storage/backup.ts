import { z } from 'zod';
import { storage } from '#imports';
import type { Note } from '@/domain/notes';
import type { Settings } from '@/domain/settings';
import type { DailyStats } from '@/domain/statistics';
import type { StoredCard } from '@/infrastructure/storage/cards/codec';

import { deleteNote, getNote } from './notes';
import { getNoteStorageKey, STORAGE_KEYS } from './storage-keys';

export interface ExportData {
  schemaVersion: number;
  exportDate: string;
  dataUpdatedAt?: string;
  data: {
    cards: Record<string, StoredCard>;
    stats: Record<string, DailyStats>;
    notes: Record<string, Note>;
    settings: Partial<Settings>;
    gistSync?: {
      gistId?: string;
      enabled?: boolean;
    };
  };
}

export type PreparedImportData = {
  cards: Record<string, StoredCard>;
  stats: Record<string, DailyStats>;
  notes: Record<string, Note>;
  settings: Partial<Settings>;
  gistSync?: ExportData['data']['gistSync'];
  dataUpdatedAt: string;
};

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

const nonemptyString = z.string().refine((value) => value.trim().length > 0);
const count = z.int().nonnegative();
const storedDate = z.number().refine((value) => Number.isFinite(new Date(value).getTime()));
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

const cardSchema = z.looseObject({
  id: nonemptyString,
  slug: nonemptyString,
  name: nonemptyString,
  leetcodeId: nonemptyString,
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  domain: z.enum(['leetcode.com', 'leetcode.cn']),
  paused: z.boolean(),
  createdAt: storedDate,
  fsrs: z.looseObject({
    due: storedDate,
    last_review: storedDate.optional(),
    state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    stability: z.number().nonnegative(),
    difficulty: z.number().nonnegative(),
    elapsed_days: z.number().nonnegative(),
    scheduled_days: z.number().nonnegative(),
    reps: count,
    lapses: count,
    learning_steps: count,
  }),
}) satisfies z.ZodType<StoredCard>;

const statsSchema = z.looseObject({
  date: calendarDate,
  totalReviews: count,
  newCards: count,
  reviewedCards: count,
  streak: count,
  gradeBreakdown: z.looseObject({ 1: count, 2: count, 3: count, 4: count }),
}) satisfies z.ZodType<DailyStats>;

const noteSchema = z.looseObject({ text: z.string() }) satisfies z.ZodType<Note>;

const backupRecordsSchema = z.object({
  cards: z.record(z.string(), cardSchema),
  stats: z.record(z.string(), statsSchema),
  notes: z.record(z.string(), noteSchema),
});

export function validateBackupRecords(records: unknown) {
  return backupRecordsSchema.parse(records);
}
